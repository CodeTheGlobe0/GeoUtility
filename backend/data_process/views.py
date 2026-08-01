import io
import zipfile
from pathlib import Path

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .serializers import DataValidateSerializer
from .models import FileUploadRecord, get_extraction_relative_path

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
            relative_path = get_extraction_relative_path(record)
            destination_dir = Path(settings.MEDIA_ROOT) / relative_path
            destination_dir.mkdir(parents=True, exist_ok=True)

            with zipfile.ZipFile(io.BytesIO(data.get("decoded_bytes"))) as zip_file:
                zip_file.extractall(destination_dir)

            record.extracted_path = relative_path
            record.status = 'SUCCESS'
            record.status_message = data.get("success_message")
            record.save()

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

        first_field_errors = next(iter(serializer.errors.values()), None)
        if first_field_errors and len(first_field_errors) > 1:
            message = f"{len(first_field_errors)} validation errors occurred."
        elif first_field_errors:
            message = str(first_field_errors[0])
        else:
            message = "Validation failed."
        return Response({
            "success": False,
            "message": message,
            "data": None,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
