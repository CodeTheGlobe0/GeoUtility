"""
Connects to whichever external GIS database is currently marked active
(admin_panel.models.GISDatabaseConnection.is_active) and reads spatial data
from it — the live-database counterpart to GeoReader (which reads uploaded
.gdb/.shp files instead).

Each engine (PostgreSQL/PostGIS, SQL Server, Oracle) has a very different
way of storing and querying geometry, so this dispatches to a small
per-engine implementation. Geometry is always converted to WKT in SQL (or
read natively via geopandas for PostGIS) and reprojected to WGS84
(EPSG:4326) before being returned, matching GeoReader's contract so the
frontend can treat both sources identically.

It also does the reverse: write_geodataframe() pushes an uploaded feature
class (a GeoDataFrame from GeoReader.read_as_geodataframes()) into the
active database, appending to a matching table if one already exists (by
name) or creating it first if not.

Reading a single table (read_table_as_geojson/read_table_as_records, and
load_table) additionally accepts an optional `filters` list — one or more
attribute conditions, e.g. [{"field": "name", "op": "=", "value":
"Telangana"}], combined with SQL AND. Every condition's field name is
validated against the table's real columns (queried per-engine) before
being used, and every value is passed as a bound query parameter — never
interpolated into the SQL string — so this can't be used to inject
arbitrary SQL through the field or value.

NOTE: only the PostgreSQL path has been exercised end-to-end (via
geopandas.read_postgis/to_postgis, well-trodden paths). The SQL Server and
Oracle paths are implemented against each vendor's documented spatial SQL
functions (STAsText / STGeomFromText, SDO_UTIL.TO_WKTGEOMETRY /
SDO_UTIL.FROM_WKTGEOMETRY) but could not be tested here against a live
instance of either — treat them as a solid starting point, not as verified.
The Oracle write path also does not register the new geometry column in
USER_SDO_GEOM_METADATA or build a spatial index, since that requires
knowing the layer's real coordinate extent up front; the column is written
and readable, but won't be spatially indexed until that's done separately.
"""
import datetime
import decimal
import json
from typing import Any, Dict, List, Optional, Set, Tuple

import geopandas as gpd
import pandas as pd
from shapely import wkt as shapely_wkt

# Presence of any of these (case-insensitive) marks a database as an Esri
# ArcGIS geodatabase rather than a plain spatial database: GDB_ITEMS/
# GDB_ITEMTYPES are the modern (10.1+) geodatabase catalog, SDE_LAYERS/
# SDE_VERSIONS are the classic ArcSDE ones.
ARCGIS_MARKER_TABLES = {"gdb_items", "gdb_itemtypes", "sde_layers", "sde_versions"}

# Attribute-filter operators accepted by read_table_as_geojson/records's
# `filters` argument. "like" does a case-insensitive substring match
# (the value is wrapped in %...% automatically); every other operator is
# used as-is in the generated SQL.
ALLOWED_FILTER_OPS = {"=", "!=", ">", "<", ">=", "<=", "like"}


class GISConnectionError(Exception):
    """Raised for any failure connecting to or querying the external database."""


class GISFilterError(Exception):
    """Raised when a requested attribute filter names an unknown field or an unsupported operator."""


class GISDatabaseLoader:
    def __init__(self, connection):
        self.connection = connection

    def _host_port(self, default_port: int):
        instance = (self.connection.instance or "").strip()
        if ":" in instance:
            host, _, port = instance.rpartition(":")
            try:
                return host, int(port)
            except ValueError:
                return instance, default_port
        return instance, default_port

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect_database_kind(self) -> Dict[str, Any]:
        """
        First step for any load: is this an Esri ArcGIS (Enterprise/Workgroup)
        geodatabase, or a plain spatial database? Detected by checking whether
        any of ArcGIS's own system tables exist — nothing else is done with
        this yet (see db_loader module docstring / LoadDataView).
        """
        dbtype = self.connection.gisdbtype
        if dbtype == "POSTGRES":
            found = self._find_marker_tables_postgres()
        elif dbtype == "SQLSERVER":
            found = self._find_marker_tables_sqlserver()
        elif dbtype == "ORACLE":
            found = self._find_marker_tables_oracle()
        else:
            raise GISConnectionError(f"Unsupported gisdbtype '{dbtype}'.")

        return {
            "kind": "ARCGIS" if found else "NORMAL",
            "matched_tables": sorted(found),
        }

    def _find_marker_tables_postgres(self) -> Set[str]:
        from sqlalchemy import text

        engine = self._postgres_engine()
        query = text(
            "SELECT lower(table_name) AS table_name FROM information_schema.tables "
            "WHERE lower(table_name) = ANY(:names)"
        )
        try:
            with engine.connect() as conn:
                rows = conn.execute(query, {"names": list(ARCGIS_MARKER_TABLES)}).all()
        except Exception as e:
            raise GISConnectionError(f"Could not query PostgreSQL metadata: {e}") from e
        return {row[0] for row in rows}

    def _find_marker_tables_sqlserver(self) -> Set[str]:
        conn = self._sqlserver_connect()
        names = list(ARCGIS_MARKER_TABLES)
        placeholders = ",".join("?" for _ in names)
        query = f"SELECT LOWER(name) FROM sys.tables WHERE LOWER(name) IN ({placeholders})"
        try:
            cursor = conn.cursor()
            cursor.execute(query, names)
            found = {row[0] for row in cursor.fetchall()}
        except Exception as e:
            raise GISConnectionError(f"Could not query SQL Server metadata: {e}") from e
        finally:
            conn.close()
        return found

    def _find_marker_tables_oracle(self) -> Set[str]:
        conn = self._oracle_connect()
        names = list(ARCGIS_MARKER_TABLES)
        placeholders = ",".join(f":n{i}" for i in range(len(names)))
        bind = {f"n{i}": name for i, name in enumerate(names)}
        query = f"SELECT LOWER(table_name) FROM all_tables WHERE LOWER(table_name) IN ({placeholders})"
        try:
            cursor = conn.cursor()
            cursor.execute(query, bind)
            found = {row[0] for row in cursor.fetchall()}
        except Exception as e:
            raise GISConnectionError(f"Could not query Oracle metadata: {e}") from e
        finally:
            conn.close()
        return found

    def list_tables(self) -> List[Dict[str, Any]]:
        dbtype = self.connection.gisdbtype
        if dbtype == "POSTGRES":
            return self._list_tables_postgres()
        if dbtype == "SQLSERVER":
            return self._list_tables_sqlserver()
        if dbtype == "ORACLE":
            return self._list_tables_oracle()
        raise GISConnectionError(f"Unsupported gisdbtype '{dbtype}'.")

    def read_table_as_geojson(self, table_name: str, filters: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        dbtype = self.connection.gisdbtype
        if dbtype == "POSTGRES":
            return self._read_table_postgres(table_name, filters)
        if dbtype == "SQLSERVER":
            return self._read_table_sqlserver(table_name, filters)
        if dbtype == "ORACLE":
            return self._read_table_oracle(table_name, filters)
        raise GISConnectionError(f"Unsupported gisdbtype '{dbtype}'.")

    def read_table_as_records(self, table_name: str, filters: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """Plain (non-spatial) table read: no geometry handling at all."""
        dbtype = self.connection.gisdbtype
        if dbtype == "POSTGRES":
            return self._read_table_records_postgres(table_name, filters)
        if dbtype == "SQLSERVER":
            return self._read_table_records_sqlserver(table_name, filters)
        if dbtype == "ORACLE":
            return self._read_table_records_oracle(table_name, filters)
        raise GISConnectionError(f"Unsupported gisdbtype '{dbtype}'.")

    def list_all_tables(self) -> List[Dict[str, Any]]:
        """
        Every table in the database, each tagged with level: 'layer' (has a
        geometry column — the frontend renders it on the map) or 'attribute'
        (plain table — the frontend shows it as a simple floating table).
        """
        dbtype = self.connection.gisdbtype
        if dbtype == "POSTGRES":
            all_names = self._list_all_table_names_postgres()
        elif dbtype == "SQLSERVER":
            all_names = self._list_all_table_names_sqlserver()
        elif dbtype == "ORACLE":
            all_names = self._list_all_table_names_oracle()
        else:
            raise GISConnectionError(f"Unsupported gisdbtype '{dbtype}'.")

        spatial_by_short_name = {
            entry["table"].split(".")[-1].strip('"[]').lower(): entry
            for entry in self.list_tables()
        }

        result = []
        for full_name in all_names:
            short_name = full_name.split(".")[-1].strip('"[]').lower()
            spatial_entry = spatial_by_short_name.get(short_name)
            if spatial_entry:
                result.append({**spatial_entry, "level": "layer"})
            else:
                result.append({"table": full_name, "level": "attribute"})
        return result

    def load_table(self, table_name: str, filters: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Auto-detects whether table_name is a spatial layer or a plain
        attribute table (by checking it against list_tables()'s geometry
        catalog) and reads it accordingly. `filters`, if given, restricts
        the rows returned — see the module docstring.
        """
        short_name = table_name.split(".")[-1].strip('"[]').lower()
        is_layer = any(
            entry["table"].split(".")[-1].strip('"[]').lower() == short_name
            for entry in self.list_tables()
        )

        if is_layer:
            return {"level": "layer", "geojson": self.read_table_as_geojson(table_name, filters)}
        return {"level": "attribute", "records": self.read_table_as_records(table_name, filters)}

    def list_columns(self, table_name: str) -> List[str]:
        """
        Every real column name on a table — used to populate the frontend's
        attribute-filter field dropdown (and, internally, by _validate_filter
        to reject a filter on a field that doesn't exist).
        """
        dbtype = self.connection.gisdbtype
        if dbtype == "POSTGRES":
            return self._list_columns_postgres(table_name)
        if dbtype == "SQLSERVER":
            return self._list_columns_sqlserver(table_name)
        if dbtype == "ORACLE":
            return self._list_columns_oracle(table_name)
        raise GISConnectionError(f"Unsupported gisdbtype '{dbtype}'.")

    def list_distinct_values(self, table_name: str, field: str, limit: int = 200) -> List[Any]:
        """
        Up to `limit` distinct, non-null values for one column — used to
        populate the frontend's attribute-filter value dropdown. `field` is
        validated against the table's real columns first (via
        _validate_filter, reused here purely for its field-name check).
        """
        valid_columns = self.list_columns(table_name)
        column, _, _ = self._validate_filter({"field": field, "value": None}, valid_columns)

        dbtype = self.connection.gisdbtype
        if dbtype == "POSTGRES":
            return self._list_distinct_values_postgres(table_name, column, limit)
        if dbtype == "SQLSERVER":
            return self._list_distinct_values_sqlserver(table_name, column, limit)
        if dbtype == "ORACLE":
            return self._list_distinct_values_oracle(table_name, column, limit)
        raise GISConnectionError(f"Unsupported gisdbtype '{dbtype}'.")

    def table_exists(self, table_name: str) -> bool:
        """
        Whether a table with this name already exists in the database
        (spatial or not), matched case-insensitively on the short name (the
        part after any schema prefix) — the same matching rule list_all_tables()
        and load_table() use. Used before a write so it can decide whether to
        append to an existing table or create a new one.
        """
        short_name = table_name.split(".")[-1].strip('"[]').lower()
        dbtype = self.connection.gisdbtype
        if dbtype == "POSTGRES":
            existing = self._list_all_table_names_postgres()
        elif dbtype == "SQLSERVER":
            existing = self._list_all_table_names_sqlserver()
        elif dbtype == "ORACLE":
            existing = self._list_all_table_names_oracle()
        else:
            raise GISConnectionError(f"Unsupported gisdbtype '{dbtype}'.")
        return any(name.split(".")[-1].strip('"[]').lower() == short_name for name in existing)

    def write_geodataframe(self, table_name: str, gdf: gpd.GeoDataFrame) -> Dict[str, Any]:
        """
        Pushes an uploaded feature class into the active database: appends
        to the table if one with this name already exists, otherwise
        creates it first (with a geometry column matching gdf's). Returns
        {"created": bool, "row_count": int}.
        """
        dbtype = self.connection.gisdbtype
        already_existed = self.table_exists(table_name)

        if dbtype == "POSTGRES":
            self._write_geodataframe_postgres(table_name, gdf)
        elif dbtype == "SQLSERVER":
            self._write_geodataframe_sqlserver(table_name, gdf, already_existed)
        elif dbtype == "ORACLE":
            self._write_geodataframe_oracle(table_name, gdf, already_existed)
        else:
            raise GISConnectionError(f"Unsupported gisdbtype '{dbtype}'.")

        return {"created": not already_existed, "row_count": len(gdf)}

    # ------------------------------------------------------------------
    # PostgreSQL / PostGIS
    # ------------------------------------------------------------------

    def _postgres_engine(self):
        try:
            from sqlalchemy import create_engine
            from sqlalchemy.engine import URL
        except ImportError as e:
            raise GISConnectionError("sqlalchemy is not installed.") from e

        host, port = self._host_port(5432)
        c = self.connection
        # Built via URL.create() rather than an f-string: a username/password
        # containing a character like '@', ':', or '/' (e.g. a password of
        # "ttpl@123") would otherwise be misparsed as part of the host —
        # URL.create() percent-encodes each component correctly.
        url = URL.create(
            "postgresql+psycopg2",
            username=c.username,
            password=c.password,
            host=host,
            port=port,
            database=c.database,
        )
        try:
            return create_engine(url)
        except Exception as e:
            raise GISConnectionError(f"Failed to create PostgreSQL engine: {e}") from e

    def _list_tables_postgres(self) -> List[Dict[str, Any]]:
        from sqlalchemy import text

        engine = self._postgres_engine()
        query = text(
            "SELECT f_table_schema, f_table_name, f_geometry_column, srid, type "
            "FROM geometry_columns ORDER BY f_table_schema, f_table_name"
        )
        try:
            with engine.connect() as conn:
                rows = conn.execute(query).mappings().all()
        except Exception as e:
            raise GISConnectionError(f"Could not connect or query PostgreSQL: {e}") from e

        return [
            {
                "table": f"{row['f_table_schema']}.{row['f_table_name']}",
                "geometry_column": row["f_geometry_column"],
                "srid": row["srid"],
                "geometry_type": row["type"],
            }
            for row in rows
        ]

    def _read_table_postgres(self, table_name: str, filters: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        geopandas.read_postgis's geom_col parameter defaults to "geom" (not
        "whatever the real column is") when omitted, so a table whose
        geometry column is named anything else — e.g. "geometry", which is
        what write_geodataframe()/GeoReader produce — must have its real
        column name looked up first, the same way the SQL Server/Oracle read
        paths do via _find_geometry_column().
        """
        from sqlalchemy import text

        engine = self._postgres_engine()
        geometry_column = self._find_geometry_column(table_name, self._list_tables_postgres())
        where_sql, params = self._build_where_postgres(table_name, filters)
        sql = f'SELECT * FROM {table_name}' + (f' WHERE {where_sql}' if where_sql else '')
        try:
            # Named (:key) bind parameters only get substituted when the SQL
            # is a sqlalchemy TextClause, not a bare string — pandas/geopandas
            # pass a bare string straight to the DBAPI driver unmodified.
            gdf = gpd.read_postgis(text(sql), engine, geom_col=geometry_column, params=params)
        except Exception as e:
            raise GISConnectionError(f"Could not read table '{table_name}': {e}") from e

        return _geodataframe_to_feature_collection(gdf)

    def _list_columns_postgres(self, table_name: str) -> List[str]:
        from sqlalchemy import text

        schema, name = table_name.split(".", 1) if "." in table_name else ("public", table_name)
        engine = self._postgres_engine()
        query = text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = :name"
        )
        try:
            with engine.connect() as conn:
                rows = conn.execute(query, {"schema": schema, "name": name}).all()
        except Exception as e:
            raise GISConnectionError(f"Could not list columns for '{table_name}': {e}") from e
        return [row[0] for row in rows]

    def _list_distinct_values_postgres(self, table_name: str, column: str, limit: int) -> List[Any]:
        from sqlalchemy import text

        engine = self._postgres_engine()
        query = text(
            f'SELECT DISTINCT "{column}" FROM {table_name} '
            f'WHERE "{column}" IS NOT NULL ORDER BY "{column}" LIMIT :limit'
        )
        try:
            with engine.connect() as conn:
                rows = conn.execute(query, {"limit": limit}).all()
        except Exception as e:
            raise GISConnectionError(f"Could not list values for '{table_name}.{column}': {e}") from e
        return [_json_safe(row[0]) for row in rows]

    def _build_where_postgres(
        self, table_name: str, filters: Optional[List[Dict[str, Any]]]
    ) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        if not filters:
            return None, None
        valid_columns = self._list_columns_postgres(table_name)
        conditions = []
        params: Dict[str, Any] = {}
        for i, f in enumerate(filters):
            col, op, value = self._validate_filter(f, valid_columns)
            key = f"p{i}"
            if op == "like":
                conditions.append(f'"{col}" ILIKE :{key}')
                params[key] = f"%{value}%"
            else:
                conditions.append(f'"{col}" {"<>" if op == "!=" else op} :{key}')
                params[key] = value
        return " AND ".join(conditions), params

    def _list_all_table_names_postgres(self) -> List[str]:
        from sqlalchemy import text

        engine = self._postgres_engine()
        query = text(
            "SELECT table_schema, table_name FROM information_schema.tables "
            "WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') "
            "ORDER BY table_schema, table_name"
        )
        try:
            with engine.connect() as conn:
                rows = conn.execute(query).all()
        except Exception as e:
            raise GISConnectionError(f"Could not list PostgreSQL tables: {e}") from e
        return [f"{row[0]}.{row[1]}" for row in rows]

    def _read_table_records_postgres(self, table_name: str, filters: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        from sqlalchemy import text

        engine = self._postgres_engine()
        where_sql, params = self._build_where_postgres(table_name, filters)
        sql = f'SELECT * FROM {table_name}' + (f' WHERE {where_sql}' if where_sql else '')
        try:
            df = pd.read_sql(text(sql), engine, params=params)
        except Exception as e:
            raise GISConnectionError(f"Could not read table '{table_name}': {e}") from e
        return _dataframe_to_records(df)

    def _write_geodataframe_postgres(self, table_name: str, gdf: gpd.GeoDataFrame) -> None:
        """
        geopandas.to_postgis(if_exists="append") creates the table (with a
        matching geometry column type/SRID, via GeoAlchemy2) the first time,
        and appends rows on every subsequent call — exactly the
        create-or-append behaviour this method needs, in one call.
        """
        engine = self._postgres_engine()
        schema, name = table_name.split(".", 1) if "." in table_name else (None, table_name)
        try:
            gdf.to_postgis(name, engine, schema=schema, if_exists="append", index=False)
        except Exception as e:
            raise GISConnectionError(f"Could not write to table '{table_name}': {e}") from e

    # ------------------------------------------------------------------
    # SQL Server
    # ------------------------------------------------------------------

    def _sqlserver_connect(self):
        try:
            import pyodbc
        except ImportError as e:
            raise GISConnectionError("pyodbc is not installed.") from e

        available_drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
        driver = available_drivers[0] if available_drivers else "SQL Server"

        host, port = self._host_port(1433)
        c = self.connection
        conn_str = (
            f"DRIVER={{{driver}}};SERVER={host},{port};DATABASE={c.database};"
            f"UID={c.username};PWD={c.password};TrustServerCertificate=yes;"
        )
        try:
            return pyodbc.connect(conn_str, timeout=10)
        except Exception as e:
            raise GISConnectionError(f"Could not connect to SQL Server: {e}") from e

    def _list_tables_sqlserver(self) -> List[Dict[str, Any]]:
        conn = self._sqlserver_connect()
        query = """
            SELECT s.name AS table_schema, t.name AS table_name, c.name AS geometry_column, ty.name AS geometry_type
            FROM sys.columns c
            JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            JOIN sys.tables t ON c.object_id = t.object_id
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE ty.name IN ('geometry', 'geography')
            ORDER BY s.name, t.name
        """
        try:
            cursor = conn.cursor()
            cursor.execute(query)
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            raise GISConnectionError(f"Could not query SQL Server metadata: {e}") from e
        finally:
            conn.close()

        return [
            {
                "table": f"{row['table_schema']}.{row['table_name']}",
                "geometry_column": row["geometry_column"],
                "srid": None,
                "geometry_type": row["geometry_type"],
            }
            for row in rows
        ]

    def _read_table_sqlserver(self, table_name: str, filters: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        conn = self._sqlserver_connect()
        try:
            geometry_column = self._find_geometry_column(table_name, self._list_tables_sqlserver())
            where_sql, params = self._build_where_sqlserver(table_name, filters)
            query = (
                f'SELECT *, [{geometry_column}].STAsText() AS __wkt_geom, '
                f'[{geometry_column}].STSrid AS __srid FROM {table_name}'
                + (f' WHERE {where_sql}' if where_sql else '')
            )
            cursor = conn.cursor()
            cursor.execute(query, params or [])
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
        except Exception as e:
            raise GISConnectionError(f"Could not read table '{table_name}': {e}") from e
        finally:
            conn.close()

        return _rows_to_feature_collection(columns, rows, geometry_column, wkt_col="__wkt_geom", srid_col="__srid")

    def _list_columns_sqlserver(self, table_name: str) -> List[str]:
        schema, name = table_name.split(".", 1) if "." in table_name else (None, table_name)
        conn = self._sqlserver_connect()
        try:
            cursor = conn.cursor()
            if schema:
                cursor.execute(
                    "SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id "
                    "JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = ? AND t.name = ?",
                    schema, name,
                )
            else:
                cursor.execute(
                    "SELECT c.name FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = ?",
                    name,
                )
            return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            raise GISConnectionError(f"Could not list columns for '{table_name}': {e}") from e
        finally:
            conn.close()

    def _list_distinct_values_sqlserver(self, table_name: str, column: str, limit: int) -> List[Any]:
        conn = self._sqlserver_connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                f'SELECT DISTINCT TOP ({limit}) [{column}] FROM {table_name} '
                f'WHERE [{column}] IS NOT NULL ORDER BY [{column}]'
            )
            return [_json_safe(row[0]) for row in cursor.fetchall()]
        except Exception as e:
            raise GISConnectionError(f"Could not list values for '{table_name}.{column}': {e}") from e
        finally:
            conn.close()

    def _build_where_sqlserver(
        self, table_name: str, filters: Optional[List[Dict[str, Any]]]
    ) -> Tuple[Optional[str], Optional[List[Any]]]:
        if not filters:
            return None, None
        valid_columns = self._list_columns_sqlserver(table_name)
        conditions = []
        params: List[Any] = []
        for f in filters:
            col, op, value = self._validate_filter(f, valid_columns)
            if op == "like":
                conditions.append(f'[{col}] LIKE ?')
                params.append(f"%{value}%")
            else:
                conditions.append(f'[{col}] {"<>" if op == "!=" else op} ?')
                params.append(value)
        return " AND ".join(conditions), params

    def _list_all_table_names_sqlserver(self) -> List[str]:
        conn = self._sqlserver_connect()
        query = """
            SELECT s.name AS table_schema, t.name AS table_name
            FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
            ORDER BY s.name, t.name
        """
        try:
            cursor = conn.cursor()
            cursor.execute(query)
            rows = cursor.fetchall()
        except Exception as e:
            raise GISConnectionError(f"Could not list SQL Server tables: {e}") from e
        finally:
            conn.close()
        return [f"{row[0]}.{row[1]}" for row in rows]

    def _read_table_records_sqlserver(self, table_name: str, filters: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        conn = self._sqlserver_connect()
        try:
            where_sql, params = self._build_where_sqlserver(table_name, filters)
            query = f'SELECT * FROM {table_name}' + (f' WHERE {where_sql}' if where_sql else '')
            cursor = conn.cursor()
            cursor.execute(query, params or [])
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            raise GISConnectionError(f"Could not read table '{table_name}': {e}") from e
        finally:
            conn.close()
        return _stringify_records(rows)

    def _write_geodataframe_sqlserver(self, table_name: str, gdf: gpd.GeoDataFrame, already_existed: bool) -> None:
        """
        SQL Server has no geopandas-native writer, so this builds the SQL by
        hand: CREATE TABLE (once, if the table is new) inferring a column
        type per pandas dtype and a `geometry` column for the geometry, then
        INSERT every row with geometry::STGeomFromText(wkt, 4326) for the
        geometry value.
        """
        conn = self._sqlserver_connect()
        geom_col = gdf.geometry.name
        columns = list(gdf.columns)
        try:
            cursor = conn.cursor()

            if not already_existed:
                column_defs = ", ".join(
                    f"[{col}] geometry" if col == geom_col else f"[{col}] {_sqlserver_column_type(gdf[col])}"
                    for col in columns
                )
                cursor.execute(f"CREATE TABLE {table_name} ({column_defs})")

            column_list = ", ".join(f"[{col}]" for col in columns)
            placeholders = ", ".join(
                "geometry::STGeomFromText(?, 4326)" if col == geom_col else "?"
                for col in columns
            )
            insert_sql = f"INSERT INTO {table_name} ({column_list}) VALUES ({placeholders})"

            rows = [
                tuple(
                    (row[col].wkt if row[col] is not None else None) if col == geom_col else _sql_safe_value(row[col])
                    for col in columns
                )
                for _, row in gdf.iterrows()
            ]
            cursor.executemany(insert_sql, rows)
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise GISConnectionError(f"Could not write to table '{table_name}': {e}") from e
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Oracle
    # ------------------------------------------------------------------

    def _oracle_connect(self):
        try:
            import oracledb
        except ImportError as e:
            raise GISConnectionError("oracledb is not installed.") from e

        host, port = self._host_port(1521)
        c = self.connection
        try:
            dsn = oracledb.makedsn(host, port, service_name=c.database)
            return oracledb.connect(user=c.username, password=c.password, dsn=dsn)
        except Exception as e:
            raise GISConnectionError(f"Could not connect to Oracle: {e}") from e

    def _list_tables_oracle(self) -> List[Dict[str, Any]]:
        conn = self._oracle_connect()
        query = "SELECT table_name, column_name, srid FROM user_sdo_geom_metadata ORDER BY table_name"
        try:
            cursor = conn.cursor()
            cursor.execute(query)
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            raise GISConnectionError(f"Could not query Oracle metadata: {e}") from e
        finally:
            conn.close()

        return [
            {
                "table": row["TABLE_NAME"],
                "geometry_column": row["COLUMN_NAME"],
                "srid": row["SRID"],
                "geometry_type": "SDO_GEOMETRY",
            }
            for row in rows
        ]

    def _read_table_oracle(self, table_name: str, filters: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        conn = self._oracle_connect()
        try:
            geometry_column = self._find_geometry_column(table_name, self._list_tables_oracle())
            where_sql, params = self._build_where_oracle(table_name, filters)
            query = (
                f'SELECT t.*, SDO_UTIL.TO_WKTGEOMETRY(t."{geometry_column}") AS __wkt_geom '
                f'FROM "{table_name}" t' + (f' WHERE {where_sql}' if where_sql else '')
            )
            cursor = conn.cursor()
            cursor.execute(query, params or [])
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
        except Exception as e:
            raise GISConnectionError(f"Could not read table '{table_name}': {e}") from e
        finally:
            conn.close()

        return _rows_to_feature_collection(columns, rows, geometry_column, wkt_col="__wkt_geom")

    def _list_columns_oracle(self, table_name: str) -> List[str]:
        conn = self._oracle_connect()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT column_name FROM user_tab_columns WHERE table_name = :1", [table_name.upper()])
            return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            raise GISConnectionError(f"Could not list columns for '{table_name}': {e}") from e
        finally:
            conn.close()

    def _list_distinct_values_oracle(self, table_name: str, column: str, limit: int) -> List[Any]:
        conn = self._oracle_connect()
        try:
            cursor = conn.cursor()
            # Oracle has no LIMIT clause — ROWNUM over a pre-ordered,
            # pre-deduplicated subquery is the standard equivalent.
            cursor.execute(
                f'SELECT * FROM (SELECT DISTINCT "{column}" AS v FROM "{table_name}" '
                f'WHERE "{column}" IS NOT NULL ORDER BY "{column}") WHERE ROWNUM <= :1',
                [limit],
            )
            return [_json_safe(row[0]) for row in cursor.fetchall()]
        except Exception as e:
            raise GISConnectionError(f"Could not list values for '{table_name}.{column}': {e}") from e
        finally:
            conn.close()

    def _build_where_oracle(
        self, table_name: str, filters: Optional[List[Dict[str, Any]]]
    ) -> Tuple[Optional[str], Optional[List[Any]]]:
        if not filters:
            return None, None
        valid_columns = self._list_columns_oracle(table_name)
        conditions = []
        params: List[Any] = []
        for i, f in enumerate(filters, start=1):
            col, op, value = self._validate_filter(f, valid_columns)
            if op == "like":
                conditions.append(f'"{col}" LIKE :{i}')
                params.append(f"%{value}%")
            else:
                conditions.append(f'"{col}" {"<>" if op == "!=" else op} :{i}')
                params.append(value)
        return " AND ".join(conditions), params

    def _list_all_table_names_oracle(self) -> List[str]:
        conn = self._oracle_connect()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT table_name FROM user_tables ORDER BY table_name")
            rows = cursor.fetchall()
        except Exception as e:
            raise GISConnectionError(f"Could not list Oracle tables: {e}") from e
        finally:
            conn.close()
        return [row[0] for row in rows]

    def _read_table_records_oracle(self, table_name: str, filters: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        conn = self._oracle_connect()
        try:
            where_sql, params = self._build_where_oracle(table_name, filters)
            query = f'SELECT * FROM "{table_name}"' + (f' WHERE {where_sql}' if where_sql else '')
            cursor = conn.cursor()
            cursor.execute(query, params or [])
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            raise GISConnectionError(f"Could not read table '{table_name}': {e}") from e
        finally:
            conn.close()
        return _stringify_records(rows)

    def _write_geodataframe_oracle(self, table_name: str, gdf: gpd.GeoDataFrame, already_existed: bool) -> None:
        """
        Same hand-built approach as SQL Server: CREATE TABLE (once) with an
        SDO_GEOMETRY column, then INSERT every row via
        SDO_UTIL.FROM_WKTGEOMETRY(wkt). This does not set an explicit SRID
        on the geometry or register it in USER_SDO_GEOM_METADATA — see the
        module docstring's Oracle caveat.
        """
        conn = self._oracle_connect()
        geom_col = gdf.geometry.name
        columns = list(gdf.columns)
        try:
            cursor = conn.cursor()

            if not already_existed:
                column_defs = ", ".join(
                    f'"{col}" SDO_GEOMETRY' if col == geom_col else f'"{col}" {_oracle_column_type(gdf[col])}'
                    for col in columns
                )
                cursor.execute(f'CREATE TABLE "{table_name}" ({column_defs})')

            column_list = ", ".join(f'"{col}"' for col in columns)
            placeholders = ", ".join(
                f"SDO_UTIL.FROM_WKTGEOMETRY(:{i + 1})" if col == geom_col else f":{i + 1}"
                for i, col in enumerate(columns)
            )
            insert_sql = f'INSERT INTO "{table_name}" ({column_list}) VALUES ({placeholders})'

            rows = [
                tuple(
                    (row[col].wkt if row[col] is not None else None) if col == geom_col else _sql_safe_value(row[col])
                    for col in columns
                )
                for _, row in gdf.iterrows()
            ]
            cursor.executemany(insert_sql, rows)
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise GISConnectionError(f"Could not write to table '{table_name}': {e}") from e
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _find_geometry_column(table_name: str, tables_metadata: List[Dict[str, Any]]) -> str:
        short_name = table_name.split(".")[-1].strip('"[]')
        for entry in tables_metadata:
            if entry["table"].split(".")[-1].strip('"[]').lower() == short_name.lower():
                return entry["geometry_column"]
        raise GISConnectionError(f"No geometry column found for table '{table_name}'.")

    @staticmethod
    def _validate_filter(f: Dict[str, Any], valid_columns: List[str]) -> Tuple[str, str, Any]:
        """
        Checks one {"field", "op", "value"} filter against the table's real
        columns and the allowed operator set, returning (real_column_name,
        op, value) for the caller to build SQL from. Raises GISFilterError
        (not GISConnectionError) on anything invalid, since this is a bad
        request, not a connection failure — field names are matched
        case-insensitively since column-name casing varies by engine.
        """
        valid_lookup = {c.lower(): c for c in valid_columns}
        field = f.get("field")
        op = str(f.get("op", "=")).lower()
        value = f.get("value")
        if not field or field.lower() not in valid_lookup:
            raise GISFilterError(f"Unknown field '{field}'. Valid fields: {', '.join(sorted(valid_columns))}")
        if op not in ALLOWED_FILTER_OPS:
            raise GISFilterError(f"Unsupported operator '{op}'. Allowed: {', '.join(sorted(ALLOWED_FILTER_OPS))}")
        return valid_lookup[field.lower()], op, value


def _geodataframe_to_feature_collection(gdf: gpd.GeoDataFrame) -> Dict[str, Any]:
    if gdf.crs is not None and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)
    for column in gdf.columns:
        if column == gdf.geometry.name:
            continue
        if pd.api.types.is_datetime64_any_dtype(gdf[column]):
            gdf[column] = gdf[column].apply(lambda v: v.isoformat() if pd.notna(v) else None)
    return json.loads(gdf.to_json())


def _rows_to_feature_collection(columns, rows, geometry_column, wkt_col, srid_col=None) -> Dict[str, Any]:
    """
    Builds a GeoDataFrame from raw DB-API rows where the geometry has already
    been converted to WKT in SQL (SQL Server's .STAsText() / Oracle's
    SDO_UTIL.TO_WKTGEOMETRY), then reprojects to WGS84 like GeoReader does.
    """
    records = []
    srid = None
    for row in rows:
        row_dict = dict(zip(columns, row))
        wkt_value = row_dict.pop(wkt_col, None)
        if srid_col:
            srid = row_dict.pop(srid_col, srid) or srid
        row_dict.pop(geometry_column, None)  # drop the raw binary geometry value
        row_dict["geometry"] = shapely_wkt.loads(wkt_value) if wkt_value else None
        records.append(row_dict)

    gdf = gpd.GeoDataFrame(records, geometry="geometry", crs=f"EPSG:{srid}" if srid else None)
    return _geodataframe_to_feature_collection(gdf)


def _json_safe(value: Any) -> Any:
    """Converts DB-API values that json.dumps can't handle natively."""
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (bytes, bytearray)):
        return value.hex()
    return value


def _stringify_records(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Plain (non-spatial) attribute rows from raw DB-API cursor results."""
    return [{k: _json_safe(v) for k, v in row.items()} for row in rows]


def _dataframe_to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Plain (non-spatial) attribute rows from a pandas DataFrame (Postgres)."""
    for column in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[column]):
            df[column] = df[column].apply(lambda v: v.isoformat() if pd.notna(v) else None)
    return json.loads(df.to_json(orient="records"))


def _pandas_dtype_kind(series: pd.Series) -> str:
    """Coarse dtype bucket used to pick a SQL column type when creating a new table."""
    if pd.api.types.is_bool_dtype(series):
        return "bool"
    if pd.api.types.is_integer_dtype(series):
        return "int"
    if pd.api.types.is_float_dtype(series):
        return "float"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    return "text"


def _sqlserver_column_type(series: pd.Series) -> str:
    return {
        "bool": "BIT",
        "int": "BIGINT",
        "float": "FLOAT",
        "datetime": "DATETIME2",
        "text": "NVARCHAR(MAX)",
    }[_pandas_dtype_kind(series)]


def _oracle_column_type(series: pd.Series) -> str:
    return {
        "bool": "NUMBER(1)",
        "int": "NUMBER(19)",
        "float": "BINARY_DOUBLE",
        "datetime": "TIMESTAMP",
        "text": "NCLOB",
    }[_pandas_dtype_kind(series)]


def _sql_safe_value(value: Any) -> Any:
    """
    Converts a pandas/numpy scalar (as seen while iterating a GeoDataFrame's
    rows) into a plain Python value a DB-API driver (pyodbc/oracledb) can
    bind as a parameter — numpy scalars, NaN/NaT, and pandas Timestamps all
    need to be unwrapped first.
    """
    if value is None or value is pd.NaT or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()
    if hasattr(value, "item"):  # numpy scalar (int64, float64, bool_, ...)
        return value.item()
    return value
