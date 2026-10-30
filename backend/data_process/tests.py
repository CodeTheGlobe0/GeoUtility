import io
import zipfile
import base64
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import FileUploadRecord, get_upload_path

User = get_user_model()

def create_in_memory_zip(file_structure: dict) -> bytes:
    """
    Utility to create a ZIP file in-memory.
    file_structure: dict mapping relative file path strings to bytes content.
    """
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for filepath, content in file_structure.items():
            zip_file.writestr(filepath, content)
    return zip_buffer.getvalue()

class DataProcessValidateTests(APITestCase):
    """
    Test suite for data_process schema validation api checks.
    """
    def setUp(self):
        # Create user account for login JWT token generation
        self.user = User.objects.create_user(
            username="gis_operator",
            email="operator@example.com",
            password="Password123"
        )
        self.validate_url = reverse('data_validate')
        self.login_url = reverse('auth_login')

    def get_auth_headers(self) -> dict:
        """
        Helper to fetch jwt access token headers.
        """
        response = self.client.post(self.login_url, {
            "username": "gis_operator",
            "password": "Password123"
        })
        token = response.data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_validation_requires_authentication(self):
        """
        Verify validation endpoint returns 401 Unauthorized for unauthenticated clients.
        """
        response = self.client.post(self.validate_url, {
            "user_id": "user123",
            "temp_id": "temp456",
            "file_type": ".gdb",
            "file_data": "base64encodeddummy"
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_validation_success_one_gdb(self):
        """
        Verify that a valid Base64 encoded ZIP archive containing exactly one .gdb folder
        under 'source/' succeeds.
        """
        files = {
            "source/dubai_landuse.gdb/a_gdbtable": b"mock_geometry_data",
            "source/dubai_landuse.gdb/timestamp": b"2026-07-30",
            "source/metadata.txt": b"Landuse standard files"
        }
        zip_bytes = create_in_memory_zip(files)
        b64_data = base64.b64encode(zip_bytes).decode('utf-8')

        payload = {
            "user_id": "101",
            "temp_id": "sess_8892",
            "file_type": "gdb_zip",
            "file_data": b64_data
        }

        headers = self.get_auth_headers()
        response = self.client.post(self.validate_url, payload, **headers)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["user_id"], "101")
        self.assertEqual(response.data["temp_id"], "sess_8892")
        self.assertEqual(response.data["file_type"], "gdb_zip")
        self.assertIn("validation passed", response.data["message"])

    def test_validation_invalid_base64(self):
        """
        Verify that passing invalid Base64 file_data returns a specific validation error.
        """
        payload = {
            "user_id": "101",
            "temp_id": "sess_8892",
            "file_type": "gdb_zip",
            "file_data": "invalid_base64_string_&^%$"
        }

        headers = self.get_auth_headers()
        response = self.client.post(self.validate_url, payload, **headers)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid Base64 format", response.data["file_data"][0])

    def test_validation_corrupt_zip(self):
        """
        Verify that passing valid Base64 which does not decode to a valid ZIP returns a Bad ZIP error.
        """
        dummy_bytes = b"Hello, this is a plain text, not a zip file."
        b64_data = base64.b64encode(dummy_bytes).decode('utf-8')

        payload = {
            "user_id": "101",
            "temp_id": "sess_8892",
            "file_type": "gdb_zip",
            "file_data": b64_data
        }

        headers = self.get_auth_headers()
        response = self.client.post(self.validate_url, payload, **headers)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not a valid ZIP archive", response.data["file_data"][0])

    def test_validation_missing_source_folder(self):
        """
        Verify that a ZIP file missing the 'source/' directory fails validation.
        """
        files = {
            "root_folder/dubai_landuse.gdb/table": b"mock_geometry_data",
            "metadata.txt": b"invalid metadata path"
        }
        zip_bytes = create_in_memory_zip(files)
        b64_data = base64.b64encode(zip_bytes).decode('utf-8')

        payload = {
            "user_id": "101",
            "temp_id": "sess_8892",
            "file_type": "gdb_zip",
            "file_data": b64_data
        }

        headers = self.get_auth_headers()
        response = self.client.post(self.validate_url, payload, **headers)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Missing 'source/' top-level directory", response.data["file_data"][0])

    def test_validation_zero_gdb_folders(self):
        """
        Verify that a ZIP file with 'source/' folder but 0 '.gdb' folders fails validation.
        """
        files = {
            "source/shapefile.shp": b"mock_geometry_data",
            "source/shapefile.dbf": b"mock_dbf_data"
        }
        zip_bytes = create_in_memory_zip(files)
        b64_data = base64.b64encode(zip_bytes).decode('utf-8')

        payload = {
            "user_id": "101",
            "temp_id": "sess_8892",
            "file_type": "gdb_zip",
            "file_data": b64_data
        }

        headers = self.get_auth_headers()
        response = self.client.post(self.validate_url, payload, **headers)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No '.gdb' directory found", response.data["file_data"][0])

    def test_validation_multiple_gdb_folders(self):
        """
        Verify that a ZIP file with multiple '.gdb' folders inside 'source/' fails validation.
        """
        files = {
            "source/first_dataset.gdb/table": b"mock_geometry_data",
            "source/second_dataset.gdb/table": b"mock_geometry_data"
        }
        zip_bytes = create_in_memory_zip(files)
        b64_data = base64.b64encode(zip_bytes).decode('utf-8')

        payload = {
            "user_id": "101",
            "temp_id": "sess_8892",
            "file_type": "gdb_zip",
            "file_data": b64_data
        }

        headers = self.get_auth_headers()
        response = self.client.post(self.validate_url, payload, **headers)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Exactly one '.gdb' directory is required", response.data["file_data"][0])
        self.assertIn("first_dataset.gdb", response.data["file_data"][0])
        self.assertIn("second_dataset.gdb", response.data["file_data"][0])


class FileUploadRecordModelTests(APITestCase):
    """
    Unit tests for the FileUploadRecord model definition and path generation.
    """
    def setUp(self):
        self.user = User.objects.create_user(
            username="test_model_user",
            email="model_user@example.com",
            password="Password123"
        )

    def test_file_upload_record_creation_and_fields(self):
        """
        Verify that FileUploadRecord can be created successfully with correct fields.
        """
        record = FileUploadRecord.objects.create(
            user=self.user,
            temp_id="sess_uuid_9921",
            file_type=".gdb",
            file_path="dummy_path.zip",
            status="PENDING"
        )

        self.assertEqual(record.user, self.user)
        self.assertEqual(record.temp_id, "sess_uuid_9921")
        self.assertEqual(record.file_type, ".gdb")
        self.assertEqual(record.status, "PENDING")
        self.assertIsNotNone(record.created_at)
        self.assertIsNotNone(record.updated_at)
        self.assertIn("test_model_user", str(record))

    def test_dynamic_upload_path_generation(self):
        """
        Verify that get_upload_path generates the correct dynamic format:
        upload-{user_id}-{YYYYMMDD_HHMMSS}-{temp_id}/<filename>
        """
        from django.utils import timezone
        
        record = FileUploadRecord(
            user=self.user,
            temp_id="sess_xyz",
            file_type=".gdb",
            status="SUCCESS"
        )
        
        # Manually set predictable timestamp
        fixed_now = timezone.now()
        record.created_at = fixed_now
        
        generated_path = get_upload_path(record, "upload_archive.zip")
        
        # Verify the structure using assertions
        # Expected shape: upload-{user_id}-{timestamp}-{temp_id}/upload_archive.zip
        path_parts = generated_path.split('/')
        self.assertEqual(len(path_parts), 2)
        
        folder_name = path_parts[0]
        filename = path_parts[1]
        
        self.assertEqual(filename, "upload_archive.zip")
        self.assertTrue(folder_name.startswith(f"upload-{self.user.id}-"))
        self.assertTrue(folder_name.endswith("-sess_xyz"))
        
        # Ensure timestamp matches YYYYMMDD_HHMMSS
        expected_timestamp = fixed_now.strftime('%Y%m%d_%H%M%S')
        self.assertEqual(folder_name, f"upload-{self.user.id}-{expected_timestamp}-sess_xyz")

