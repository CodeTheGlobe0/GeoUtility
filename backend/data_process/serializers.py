import base64
import binascii
import io
import zipfile
from typing import Dict, Any, Set
from rest_framework import serializers

from .models import FileUploadRecord

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


class FileUploadRecordSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = FileUploadRecord
        fields = ['id', 'username', 'temp_id', 'file_type', 'status', 'status_message', 'created_at', 'updated_at']
        read_only_fields = fields

class ZipPayloadValidationMixin:
    """
    Shared base64/zip-structure validation for any serializer that accepts a
    base64-encoded zip + file_type — used by both the initial upload
    (DataValidateSerializer) and replacing an existing upload's contents
    (UploadUpdateSerializer), so the rules can't drift between the two.
    """

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate the complete input payload, including base64 decoding and ZIP file inspections.
        Collects every applicable error (size, format, structure) instead of stopping at the first one,
        so the caller can fix everything in a single pass.
        """
        file_data_str = attrs.get('file_data', '')
        file_type = attrs.get('file_type')
        errors = []

        # 1. Validate Base64 formatting and decode into byte stream.
        # This is a hard stop: none of the later checks are possible without decoded bytes.
        try:
            # Add padding if missing in raw base64 string
            missing_padding = len(file_data_str) % 4
            if missing_padding:
                file_data_str += '=' * (4 - missing_padding)
            decoded_bytes = base64.b64decode(file_data_str, validate=True)
        except (binascii.Error, TypeError) as e:
            raise serializers.ValidationError({
                "file_data": [f"Invalid Base64 format: {str(e)}"]
            })

        # 2. Enforce maximum decoded file size (20 MB) - independent of ZIP validity
        if len(decoded_bytes) > MAX_FILE_SIZE_BYTES:
            errors.append(
                f"File size exceeds the maximum allowed limit of 20 MB (received {len(decoded_bytes) / (1024 * 1024):.2f} MB)."
            )

        # 3. Verify decoded byte stream is a valid ZIP archive
        zip_in_memory = io.BytesIO(decoded_bytes)
        if not zipfile.is_zipfile(zip_in_memory):
            errors.append("The decoded file stream is not a valid ZIP archive.")
        else:
            try:
                with zipfile.ZipFile(zip_in_memory) as zip_file:
                    namelist = zip_file.namelist()

                    # Check for top-level directory 'source/'
                    # We normalize backslashes to forward slashes for cross-platform compatibility
                    has_source = any(
                        name.replace('\\', '/').startswith('source/') for name in namelist
                    )

                    if not has_source:
                        errors.append("Missing 'source/' top-level directory inside the ZIP archive.")
                    elif file_type == 'gdb':
                        errors.extend(self._validate_gdb_structure(namelist))
                    elif file_type == 'shp':
                        errors.extend(self._validate_shp_structure(namelist))

            except zipfile.BadZipFile:
                errors.append("The decoded file stream is a corrupted ZIP archive.")

        if errors:
            raise serializers.ValidationError({"file_data": errors})

        # Include success metadata + decoded bytes (for extraction by the view) inside validated data context
        attrs['success_message'] = "File validation passed successfully."
        attrs['decoded_bytes'] = decoded_bytes
        return attrs

    @staticmethod
    def _validate_gdb_structure(namelist) -> list:
        """Enforce exactly one '<name>.gdb' directory directly inside 'source/'."""
        errors = []
        gdb_folders: Set[str] = set()

        for name in namelist:
            parts = [p for p in name.replace('\\', '/').split('/') if p]
            if len(parts) >= 2 and parts[0] == 'source' and parts[1].endswith('.gdb'):
                gdb_folders.add(parts[1])

        if len(gdb_folders) == 0:
            errors.append("No '.gdb' directory found inside the 'source/' folder.")
        elif len(gdb_folders) > 1:
            errors.append(
                f"Exactly one '.gdb' directory is required inside 'source/', but found {len(gdb_folders)}: {', '.join(sorted(gdb_folders))}."
            )
        return errors

    @staticmethod
    def _validate_shp_structure(namelist) -> list:
        """Enforce at least one '<name>.shp' anywhere inside 'source/' (any subfolder depth, multiple allowed), each with its required .shx/.dbf siblings."""
        errors = []
        extensions_by_path: Dict[str, Set[str]] = {}

        for name in namelist:
            parts = [p for p in name.replace('\\', '/').split('/') if p]
            if len(parts) >= 2 and parts[0] == 'source' and '.' in parts[-1]:
                basename, _, ext = parts[-1].rpartition('.')
                # Key includes the sub-path under source/ so files with the
                # same basename in different subfolders aren't conflated.
                path_key = '/'.join(parts[1:-1] + [basename])
                extensions_by_path.setdefault(path_key, set()).add(ext.lower())

        shp_paths = {
            path_key for path_key, exts in extensions_by_path.items() if 'shp' in exts
        }

        if len(shp_paths) == 0:
            errors.append("No '.shp' file found inside the 'source/' folder.")
        else:
            for path_key in sorted(shp_paths):
                missing = {'shp', 'shx', 'dbf'} - extensions_by_path[path_key]
                if missing:
                    errors.append(
                        f"Shapefile '{path_key}' is missing required file(s): {', '.join(sorted('.' + e for e in missing))}."
                    )
        return errors


class DataValidateSerializer(ZipPayloadValidationMixin, serializers.Serializer):
    """
    Serializer for a brand-new upload. Expects base64 encoded zip file data
    and validates the zip structure via ZipPayloadValidationMixin.
    """
    user_id = serializers.CharField(max_length=255, required=True)
    temp_id = serializers.CharField(max_length=255, required=True)
    file_type = serializers.ChoiceField(choices=['gdb', 'shp'], required=True)
    file_data = serializers.CharField(required=True)


class UploadUpdateSerializer(ZipPayloadValidationMixin, serializers.Serializer):
    """
    Serializer for replacing an existing upload's contents. The record being
    updated is identified by the URL's <pk>, so only the new file itself is
    required here — validated the same way as a brand-new upload.
    """
    file_type = serializers.ChoiceField(choices=['gdb', 'shp'], required=True)
    file_data = serializers.CharField(required=True)
