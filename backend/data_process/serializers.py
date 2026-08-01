import base64
import binascii
import io
import zipfile
from typing import Dict, Any, Set
from rest_framework import serializers

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB

class DataValidateSerializer(serializers.Serializer):
    """
    Serializer to validate the GIS data payload.
    It expects base64 encoded zip file data and validates the zip structure.
    """
    user_id = serializers.CharField(max_length=255, required=True)
    temp_id = serializers.CharField(max_length=255, required=True)
    file_type = serializers.ChoiceField(choices=['gdb', 'shp'], required=True)
    file_data = serializers.CharField(required=True)

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate the complete input payload, including base64 decoding and ZIP file inspections.
        Collects every applicable error (size, format, structure) instead of stopping at the first one,
        so the caller can fix everything in a single pass.
        """
        file_data_str = attrs.get('file_data', '')
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
                    has_source = False
                    gdb_folders: Set[str] = set()

                    for name in namelist:
                        normalized_name = name.replace('\\', '/')

                        # Verify if path starts with source/
                        if normalized_name.startswith('source/'):
                            has_source = True

                        # Split path parts to find child directories directly inside source/
                        parts = [p for p in normalized_name.split('/') if p]
                        if len(parts) >= 2 and parts[0] == 'source':
                            child = parts[1]
                            if child.endswith('.gdb'):
                                gdb_folders.add(child)

                    if not has_source:
                        errors.append("Missing 'source/' top-level directory inside the ZIP archive.")

                    # Enforce exactly one .gdb directory inside source/
                    if len(gdb_folders) == 0:
                        errors.append("No '.gdb' directory found inside the 'source/' folder.")
                    elif len(gdb_folders) > 1:
                        errors.append(
                            f"Exactly one '.gdb' directory is required inside 'source/', but found {len(gdb_folders)}: {', '.join(sorted(gdb_folders))}."
                        )

            except zipfile.BadZipFile:
                errors.append("The decoded file stream is a corrupted ZIP archive.")

        if errors:
            raise serializers.ValidationError({"file_data": errors})

        # Include success metadata + decoded bytes (for extraction by the view) inside validated data context
        attrs['success_message'] = "File validation passed successfully."
        attrs['decoded_bytes'] = decoded_bytes
        return attrs
