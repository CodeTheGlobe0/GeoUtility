import json
from pathlib import Path
from typing import Any, Dict, List

import geopandas as gpd
import pandas as pd
import pyogrio
from django.conf import settings


class GeoReader:
    """
    Resolves and reads the spatial data source (.gdb directory or .shp file)
    behind a validated FileUploadRecord, converting it to GeoJSON grouped by
    feature class/layer name.
    """

    def __init__(self, record):
        self.record = record

    def _source_dir(self) -> Path:
        return Path(settings.MEDIA_ROOT) / self.record.extracted_path / "source"

    def resolve_source_paths(self) -> List[Path]:
        """
        Locates the spatial data source(s) inside the upload's
        <extracted_path>/source/ folder, matching whichever file_type was
        recorded and validated at upload time by DataValidateSerializer:
        exactly one top-level .gdb directory, or one-or-more .shp files
        found anywhere inside source/ (including subfolders).
        """
        source_dir = self._source_dir()

        if self.record.file_type == 'gdb':
            matches = [p for p in source_dir.glob("*.gdb") if p.is_dir()]
            if len(matches) != 1:
                raise FileNotFoundError(
                    f"Expected exactly one .gdb directory under '{source_dir}', found {len(matches)}."
                )
            return matches
        if self.record.file_type == 'shp':
            matches = [p for p in source_dir.rglob("*.shp") if p.is_file()]
            if len(matches) == 0:
                raise FileNotFoundError(
                    f"Expected at least one .shp file under '{source_dir}', found 0."
                )
            return matches
        raise ValueError(f"Unsupported file_type '{self.record.file_type}' for GeoJSON extraction.")

    def read_as_geojson(self) -> Dict[str, Any]:
        """
        Resolves the source(s) on disk, reads every feature class as a
        GeoDataFrame (via read_as_geodataframes()), then converts each one to
        a standalone GeoJSON FeatureCollection. Returns a dict keyed by
        feature class/layer name.
        """
        return {name: self._feature_collection(gdf) for name, gdf in self.read_as_geodataframes().items()}

    def read_as_geodataframes(self) -> Dict[str, gpd.GeoDataFrame]:
        """
        Like read_as_geojson(), but returns each feature class as a live
        GeoDataFrame (reprojected to WGS84 when the source CRS is known)
        instead of a GeoJSON dict. Used whenever the caller needs typed
        columns and real geometry objects rather than JSON — e.g. pushing an
        upload's data into an external GIS database.
        """
        source_paths = self.resolve_source_paths()
        if self.record.file_type == 'gdb':
            return self._read_gdb_as_geodataframes(source_paths[0])
        if self.record.file_type == 'shp':
            source_dir = self._source_dir()
            result = {}
            for shp_path in source_paths:
                result.update(self._read_shp_as_geodataframes(shp_path, source_dir))
            return result
        raise ValueError(f"Unsupported file_type '{self.record.file_type}' for GeoDataFrame extraction.")

    def _read_gdb_as_geodataframes(self, gdb_path: Path) -> Dict[str, gpd.GeoDataFrame]:
        """
        Reads every feature class (layer) inside a File Geodatabase and
        returns a dict keyed by layer name, each mapping to that layer's own
        GeoDataFrame. Non-spatial tables (attribute-only, no geometry column)
        are skipped — they can't be represented as a single geometry-typed
        GeoDataFrame the same way.
        """
        result = {}
        for layer_name in self._list_gdb_layers(gdb_path):
            gdf = gpd.read_file(gdb_path, layer=layer_name, engine="pyogrio")
            if not isinstance(gdf, gpd.GeoDataFrame):
                continue
            result[layer_name] = self._reproject_to_4326(gdf)
        return result

    def _read_shp_as_geodataframes(self, shp_path: Path, source_dir: Path) -> Dict[str, gpd.GeoDataFrame]:
        """
        Reads a single shapefile and returns it keyed by its path relative to
        source/ (without extension), e.g. "ar" or "asia/ar" if nested in a
        subfolder — this keeps two same-named shapefiles in different
        subfolders from overwriting each other in the merged result.
        """
        gdf = gpd.read_file(shp_path, engine="pyogrio")
        if not isinstance(gdf, gpd.GeoDataFrame):
            return {}
        key = shp_path.relative_to(source_dir).with_suffix('').as_posix()
        return {key: self._reproject_to_4326(gdf)}

    @staticmethod
    def _list_gdb_layers(gdb_path: Path) -> List[str]:
        return [name for name, _geom_type in pyogrio.list_layers(str(gdb_path))]

    @staticmethod
    def _reproject_to_4326(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Reprojects to WGS84 (EPSG:4326) when the source CRS is known (per RFC 7946)."""
        if gdf.crs is not None and gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
        return gdf

    @classmethod
    def _feature_collection(cls, gdf: gpd.GeoDataFrame) -> Dict[str, Any]:
        """
        Converts a (already-reprojected) GeoDataFrame to a GeoJSON
        FeatureCollection dict, stringifying datetime columns first since
        to_json() can't serialize them. Operates on a copy so the original
        GeoDataFrame (which a caller may still want with real datetime
        values, e.g. for a database write) is left untouched.
        """
        gdf = cls._stringify_datetime_columns(gdf.copy())
        layer_geojson = json.loads(gdf.to_json())
        return {"type": "FeatureCollection", "features": layer_geojson.get("features", [])}

    @staticmethod
    def _stringify_datetime_columns(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """
        geopandas.GeoDataFrame.to_json() cannot serialize pandas Timestamp
        values (common in .gdb date/datetime fields), so convert them to ISO
        8601 strings (None for NaT) before json-encoding.
        """
        for column in gdf.columns:
            if column == gdf.geometry.name:
                continue
            if pd.api.types.is_datetime64_any_dtype(gdf[column]):
                gdf[column] = gdf[column].apply(lambda v: v.isoformat() if pd.notna(v) else None)
        return gdf
