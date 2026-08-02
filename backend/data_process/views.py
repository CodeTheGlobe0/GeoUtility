import io
import shutil
import zipfile
from pathlib import Path

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .serializers import DataValidateSerializer, FileUploadRecordSerializer, UploadUpdateSerializer
from .models import FileUploadRecord, get_extraction_relative_path
from .components.geo_reader import GeoReader


def _validation_error_message(serializer) -> str:
    """Builds a single human-readable summary from a serializer's .errors dict."""
    first_field_errors = next(iter(serializer.errors.values()), None)
    if first_field_errors and len(first_field_errors) > 1:
        return f"{len(first_field_errors)} validation errors occurred."
    if first_field_errors:
        return str(first_field_errors[0])
    return "Validation failed."


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
