import io
import json
import re
import shutil
import zipfile
from pathlib import Path

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from admin_panel.models import GISDatabaseConnection
from admin_panel.views import IsStaffOrSuperuser
from .serializers import DataValidateSerializer, FileUploadRecordSerializer, UploadUpdateSerializer
from .models import FileUploadRecord, get_extraction_relative_path
from .components.geo_reader import GeoReader
from .components.db_loader import GISDatabaseLoader, GISConnectionError, GISFilterError


def _validation_error_message(serializer) -> str:
    """Builds a single human-readable summary from a serializer's .errors dict."""
    first_field_errors = next(iter(serializer.errors.values()), None)
    if first_field_errors and len(first_field_errors) > 1:
        return f"{len(first_field_errors)} validation errors occurred."
    if first_field_errors:
        return str(first_field_errors[0])
    return "Validation failed."


def _safe_table_name(layer_name: str) -> str:
    """
    Turns a feature class/layer name into a valid unquoted SQL table name:
    a nested shapefile's key (e.g. "asia/in") contains a slash, which no
    engine accepts bare in an identifier, so anything that isn't a letter,
    digit, or underscore is collapsed to '_'.
    """
    safe = re.sub(r'[^0-9a-zA-Z_]', '_', layer_name).strip('_')
    return safe or "layer"


def _get_owned_record(request, pk) -> FileUploadRecord:
    """
    Looks up a FileUploadRecord by pk, scoped to the requesting user unless
    they're a superuser (admin) — admins can act on any user's upload.
    """
    lookup = {"pk": pk} if request.user.is_superuser else {"pk": pk, "user": request.user}
    return get_object_or_404(FileUploadRecord, **lookup)


def _extract_and_save(record: FileUploadRecord, file_type: str, decoded_bytes: bytes, success_message: str) -> str:
    """
    Extracts a validated zip's contents into <user_id>/<file_type>/<temp_id>
    under MEDIA_ROOT and updates the record to reflect the new SUCCESS state.
    Shared by both creating a new upload and replacing an existing one's
    contents, so the two stay in lockstep.
    """
    record.file_type = file_type
    relative_path = get_extraction_relative_path(record)
    destination_dir = Path(settings.MEDIA_ROOT) / relative_path
    destination_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(decoded_bytes)) as zip_file:
        zip_file.extractall(destination_dir)

    record.extracted_path = relative_path
    record.status = 'SUCCESS'
    record.status_message = success_message
    record.save()
    return relative_path


class DataValidateView(APIView):
    """
    API endpoint to execute validation checks on uploaded Base64 zip payloads.
    Requires user authentication via JWT.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        """
        Validate zip file schema data payload. On success, extract the archive's
        contents into a <user_id>/<file_type>/<temp_id> folder under
        MEDIA_ROOT and record the run.
        """
        serializer = DataValidateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            temp_id = data.get("temp_id")
            file_type = data.get("file_type")

            record = FileUploadRecord(
                user=request.user,
                temp_id=temp_id,
                file_type=file_type,
                status='VALIDATING',
            )
            relative_path = _extract_and_save(record, file_type, data.get("decoded_bytes"), data.get("success_message"))

            return Response({
                "success": True,
                "message": data.get("success_message"),
                "data": {
                    "user_id": data.get("user_id"),
                    "temp_id": temp_id,
                    "file_type": file_type,
                    "extracted_path": relative_path,
                },
                "errors": None
            }, status=status.HTTP_200_OK)

        return Response({
            "success": False,
            "message": _validation_error_message(serializer),
            "data": None,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class UploadListView(APIView):
    """
    API endpoint returning upload history, most recent first. Superusers
    (admins) see every user's uploads; everyone else only sees their own.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        if request.user.is_superuser:
            records = FileUploadRecord.objects.all().order_by('-created_at')
        else:
            records = FileUploadRecord.objects.filter(user=request.user).order_by('-created_at')
        serializer = FileUploadRecordSerializer(records, many=True)
        return Response({
            "success": True,
            "message": f"{len(serializer.data)} upload(s) found.",
            "data": serializer.data,
            "errors": None,
        }, status=status.HTTP_200_OK)


class UploadGeoJSONView(APIView):
    """
    API endpoint returning every feature class inside a validated upload's
    .gdb/.shp as a dict of per-layer GeoJSON FeatureCollections. Superusers
    (admins) can fetch any user's upload; everyone else only their own.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk) -> Response:
        record = _get_owned_record(request, pk)

        if record.status != 'SUCCESS':
            return Response({
                "success": False,
                "message": "This upload has not completed successful validation/extraction.",
                "data": None,
                "errors": {"id": [f"Upload status is '{record.status}', expected 'SUCCESS'."]},
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            geojson = GeoReader(record).read_as_geojson()
        except FileNotFoundError as e:
            return Response({
                "success": False,
                "message": "Could not locate the extracted data source for this upload.",
                "data": None,
                "errors": {"id": [str(e)]},
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                "success": False,
                "message": "Failed to read features from the uploaded data source.",
                "data": None,
                "errors": {"id": [str(e)]},
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        total_features = sum(len(fc.get("features", [])) for fc in geojson.values())
        return Response({
            "success": True,
            "message": f"{len(geojson)} layer(s), {total_features} feature(s) extracted.",
            "data": geojson,
            "errors": None,
        }, status=status.HTTP_200_OK)


class UploadDetailView(APIView):
    """
    API endpoint to replace (PUT) or remove (DELETE) a previously uploaded
    zip. Superusers (admins) can act on any user's upload; everyone else
    only their own.
    """
    permission_classes = [IsAuthenticated]

    def put(self, request, pk) -> Response:
        """
        Replace an existing upload's contents with a new base64 zip, validated
        the same way as a brand-new upload. The old extracted files are
        removed from disk before the new archive is extracted in their place.
        """
        record = _get_owned_record(request, pk)

        serializer = UploadUpdateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            file_type = data.get("file_type")

            if record.extracted_path:
                shutil.rmtree(Path(settings.MEDIA_ROOT) / record.extracted_path, ignore_errors=True)

            relative_path = _extract_and_save(record, file_type, data.get("decoded_bytes"), data.get("success_message"))

            return Response({
                "success": True,
                "message": data.get("success_message"),
                "data": {
                    "id": record.id,
                    "temp_id": record.temp_id,
                    "file_type": file_type,
                    "extracted_path": relative_path,
                },
                "errors": None
            }, status=status.HTTP_200_OK)

        return Response({
            "success": False,
            "message": _validation_error_message(serializer),
            "data": None,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk) -> Response:
        """Removes the upload's extracted files from disk and deletes its database record."""
        record = _get_owned_record(request, pk)

        if record.extracted_path:
            shutil.rmtree(Path(settings.MEDIA_ROOT) / record.extracted_path, ignore_errors=True)

        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LoadDataView(APIView):
    """
    Loads spatial data from whichever external GIS database (admin_panel's
    GISDatabaseConnection) is currently marked active, rather than from an
    uploaded .gdb/.shp file. Staff/superusers only, since it uses stored
    database credentials.

    Before doing anything else, this identifies whether the active connection
    is an Esri ArcGIS geodatabase or a plain spatial database (see
    GISDatabaseLoader.detect_database_kind) — informational for now, it
    doesn't change how tables are listed/loaded below yet.

    GET /api/data-process/load-data/             -> every table, tagged 'layer' or 'attribute'
    GET /api/data-process/load-data/?table=name  -> that table's data:
        - a 'layer' (has a geometry column) is converted to GeoJSON for the map
        - an 'attribute' table (no geometry) is returned as plain rows, for
          the frontend's simple floating table instead of the map

    An optional `filters` query param (only used together with `table`)
    restricts which rows come back — a JSON-encoded array of one or more
    {"field", "op", "value"} conditions, combined with AND, e.g.:
        ?table=public.in&filters=[{"field":"name","op":"=","value":"Telangana"}]
    `op` is one of =, !=, >, <, >=, <=, like (defaults to "=" if omitted).
    """
    permission_classes = [IsAuthenticated, IsStaffOrSuperuser]

    def get(self, request) -> Response:
        connection = GISDatabaseConnection.objects.filter(is_active=True).first()
        if connection is None:
            return Response({
                "success": False,
                "message": "No GIS database connection is currently marked active.",
                "data": None,
                "errors": {"connection": ["Activate a connection in GIS Database Connections first."]},
            }, status=status.HTTP_400_BAD_REQUEST)

        loader = GISDatabaseLoader(connection)
        table_name = request.query_params.get("table")
        connection_info = {
            "id": connection.id,
            "gisdbtype": connection.gisdbtype,
            "instance": connection.instance,
            "database": connection.database,
        }

        filters = None
        filters_raw = request.query_params.get("filters")
        if filters_raw:
            try:
                filters = json.loads(filters_raw)
                if not isinstance(filters, list) or not all(isinstance(f, dict) and "field" in f and "value" in f for f in filters):
                    raise ValueError("must be a JSON array of {\"field\", \"op\", \"value\"} objects.")
            except (ValueError, TypeError) as e:
                return Response({
                    "success": False,
                    "message": "Invalid 'filters' parameter.",
                    "data": None,
                    "errors": {"filters": [str(e)]},
                }, status=status.HTTP_400_BAD_REQUEST)

        try:
            database_kind = loader.detect_database_kind()

            if table_name:
                result = loader.load_table(table_name, filters)
                if result["level"] == "layer":
                    feature_count = len(result["geojson"].get("features", []))
                    message = f"Loaded '{table_name}' as a layer ({feature_count} feature(s))."
                else:
                    message = f"Loaded '{table_name}' as an attribute table ({len(result['records'])} row(s))."

                return Response({
                    "success": True,
                    "message": message,
                    "data": {
                        "connection": connection_info,
                        "database_kind": database_kind["kind"],
                        "table": table_name,
                        **result,
                    },
                    "errors": None,
                }, status=status.HTTP_200_OK)

            tables = loader.list_all_tables()
            return Response({
                "success": True,
                "message": f"{len(tables)} table(s) found on '{connection.instance}/{connection.database}'.",
                "data": {
                    "connection": connection_info,
                    "database_kind": database_kind["kind"],
                    "matched_tables": database_kind["matched_tables"],
                    "tables": tables,
                },
                "errors": None,
            }, status=status.HTTP_200_OK)
        except GISFilterError as e:
            return Response({
                "success": False,
                "message": "Invalid attribute filter.",
                "data": None,
                "errors": {"filters": [str(e)]},
            }, status=status.HTTP_400_BAD_REQUEST)
        except GISConnectionError as e:
            return Response({
                "success": False,
                "message": "Failed to load data from the active GIS database.",
                "data": None,
                "errors": {"connection": [str(e)]},
            }, status=status.HTTP_502_BAD_GATEWAY)


def _get_active_connection_or_response():
    """
    Shared by LoadDataColumnsView/LoadDataValuesView: looks up the active
    GISDatabaseConnection, returning (connection, None) on success or
    (None, error_response) if none is active — so each view can just
    `if error: return error` instead of repeating the same 400.
    """
    connection = GISDatabaseConnection.objects.filter(is_active=True).first()
    if connection is None:
        return None, Response({
            "success": False,
            "message": "No GIS database connection is currently marked active.",
            "data": None,
            "errors": {"connection": ["Activate a connection in GIS Database Connections first."]},
        }, status=status.HTTP_400_BAD_REQUEST)
    return connection, None


class LoadDataColumnsView(APIView):
    """
    Lists a table's real column names on the active GIS database connection
    — used by the frontend's attribute-filter builder to offer a searchable
    field dropdown instead of a free-typed (and easily-misspelled) field
    name. The geometry column (if the table is a spatial layer) is excluded,
    since filtering on raw geometry bytes isn't something a user would do
    from this UI. Staff/superusers only, same as the rest of this app's
    live-database endpoints.

    GET /api/data-process/load-data/columns/?table=<name>
    """
    permission_classes = [IsAuthenticated, IsStaffOrSuperuser]

    def get(self, request) -> Response:
        connection, error = _get_active_connection_or_response()
        if error:
            return error

        table_name = request.query_params.get("table")
        if not table_name:
            return Response({
                "success": False,
                "message": "The 'table' query parameter is required.",
                "data": None,
                "errors": {"table": ["This field is required."]},
            }, status=status.HTTP_400_BAD_REQUEST)

        loader = GISDatabaseLoader(connection)
        try:
            columns = loader.list_columns(table_name)
            short_name = table_name.split(".")[-1].strip('"[]').lower()
            for entry in loader.list_tables():
                if entry["table"].split(".")[-1].strip('"[]').lower() == short_name:
                    geometry_column = entry.get("geometry_column")
                    if geometry_column:
                        columns = [c for c in columns if c.lower() != geometry_column.lower()]
                    break
        except GISConnectionError as e:
            return Response({
                "success": False,
                "message": "Failed to load columns from the active GIS database.",
                "data": None,
                "errors": {"connection": [str(e)]},
            }, status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            "success": True,
            "message": f"{len(columns)} column(s) found on '{table_name}'.",
            "data": {"table": table_name, "columns": columns},
            "errors": None,
        }, status=status.HTTP_200_OK)


class LoadDataValuesView(APIView):
    """
    Up to 200 distinct, non-null values for one column on a table on the
    active GIS database connection — used by the frontend's attribute-filter
    builder to offer a searchable value dropdown alongside the field
    dropdown, so a filter condition becomes "pick from a list" instead of
    guessing exact spelling/casing. Staff/superusers only.

    GET /api/data-process/load-data/values/?table=<name>&field=<field>
    """
    permission_classes = [IsAuthenticated, IsStaffOrSuperuser]

    def get(self, request) -> Response:
        connection, error = _get_active_connection_or_response()
        if error:
            return error

        table_name = request.query_params.get("table")
        field = request.query_params.get("field")
        missing = [name for name, value in (("table", table_name), ("field", field)) if not value]
        if missing:
            return Response({
                "success": False,
                "message": f"The {' and '.join(missing)} query parameter(s) are required.",
                "data": None,
                "errors": {name: ["This field is required."] for name in missing},
            }, status=status.HTTP_400_BAD_REQUEST)

        loader = GISDatabaseLoader(connection)
        try:
            values = loader.list_distinct_values(table_name, field)
        except GISFilterError as e:
            return Response({
                "success": False,
                "message": "Invalid field.",
                "data": None,
                "errors": {"field": [str(e)]},
            }, status=status.HTTP_400_BAD_REQUEST)
        except GISConnectionError as e:
            return Response({
                "success": False,
                "message": "Failed to load values from the active GIS database.",
                "data": None,
                "errors": {"connection": [str(e)]},
            }, status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            "success": True,
            "message": f"{len(values)} distinct value(s) found for '{table_name}.{field}'.",
            "data": {"table": table_name, "field": field, "values": values},
            "errors": None,
        }, status=status.HTTP_200_OK)


class UploadPushToDatabaseView(APIView):
    """
    Pushes a successfully validated upload's feature classes into whichever
    GISDatabaseConnection is currently marked active. For each feature
    class/layer found in the upload, this checks whether a table with a
    matching name already exists in the target database:
        - if it exists: the upload's rows are appended to it
        - if it doesn't: the table (with a matching geometry column) is
          created first, then the rows are inserted

    Only spatial feature classes are pushed — plain (non-spatial) tables
    inside a .gdb aren't read by GeoReader at all, so there's nothing to
    push for those. Staff/superusers only, since it writes to an external
    database using stored credentials.

    POST /api/data-process/uploads/<id>/push-to-database/
    """
    permission_classes = [IsAuthenticated, IsStaffOrSuperuser]

    def post(self, request, pk) -> Response:
        record = _get_owned_record(request, pk)

        if record.status != 'SUCCESS':
            return Response({
                "success": False,
                "message": "This upload has not completed successful validation/extraction.",
                "data": None,
                "errors": {"id": [f"Upload status is '{record.status}', expected 'SUCCESS'."]},
            }, status=status.HTTP_400_BAD_REQUEST)

        connection = GISDatabaseConnection.objects.filter(is_active=True).first()
        if connection is None:
            return Response({
                "success": False,
                "message": "No GIS database connection is currently marked active.",
                "data": None,
                "errors": {"connection": ["Activate a connection in GIS Database Connections first."]},
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            layers = GeoReader(record).read_as_geodataframes()
        except FileNotFoundError as e:
            return Response({
                "success": False,
                "message": "Could not locate the extracted data source for this upload.",
                "data": None,
                "errors": {"id": [str(e)]},
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                "success": False,
                "message": "Failed to read features from the uploaded data source.",
                "data": None,
                "errors": {"id": [str(e)]},
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        if not layers:
            return Response({
                "success": False,
                "message": "This upload has no spatial feature classes to push.",
                "data": None,
                "errors": {"id": ["No feature classes (layers with geometry) were found in this upload."]},
            }, status=status.HTTP_400_BAD_REQUEST)

        connection_info = {"id": connection.id, "instance": connection.instance, "database": connection.database}
        loader = GISDatabaseLoader(connection)
        results = []

        try:
            for layer_name, gdf in layers.items():
                table_name = _safe_table_name(layer_name)
                outcome = loader.write_geodataframe(table_name, gdf)
                results.append({
                    "layer": layer_name,
                    "table": table_name,
                    "action": "created" if outcome["created"] else "appended",
                    "row_count": outcome["row_count"],
                })
        except GISConnectionError as e:
            return Response({
                "success": False,
                "message": (
                    f"Failed to push data to the active GIS database after processing "
                    f"{len(results)} of {len(layers)} feature class(es)."
                ),
                "data": {"connection": connection_info, "results": results},
                "errors": {"connection": [str(e)]},
            }, status=status.HTTP_502_BAD_GATEWAY)

        created_count = sum(1 for r in results if r["action"] == "created")
        appended_count = len(results) - created_count
        return Response({
            "success": True,
            "message": (
                f"Pushed {len(results)} feature class(es) to '{connection.instance}/{connection.database}' "
                f"({created_count} created, {appended_count} appended)."
            ),
            "data": {"connection": connection_info, "results": results},
            "errors": None,
        }, status=status.HTTP_200_OK)


