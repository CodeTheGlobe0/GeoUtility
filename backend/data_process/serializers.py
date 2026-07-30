import base64
import binascii
import io
import zipfile
from typing import Dict, Any, Set
from rest_framework import serializers

class DataValidateSerializer(serializers.Serializer):
    """
    Serializer to validate the GIS data payload.
    It expects base64 encoded zip file data and validates the zip structure.
    """
    user_id = serializers.CharField(max_length=255, required=True)
    temp_id = serializers.CharField(max_length=255, required=True)
    file_type = serializers.CharField(max_length=50, required=True)
    file_data = serializers.CharField(required=True)

    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate the complete input payload, including base64 decoding and ZIP file inspections.
        """
        user_id = attrs.get('user_id')
        temp_id = attrs.get('temp_id')
        file_type = attrs.get('file_type')
        file_data_str = attrs.get('file_data', '')

        # 1. Validate Base64 formatting and decode into byte stream
        try:
            # Add padding if missing in raw base64 string
            missing_padding = len(file_data_str) % 4
            if missing_padding:
                file_data_str += '=' * (4 - missing_padding)
            decoded_bytes = base64.b64decode(file_data_str, validate=True)
        except (binascii.Error, TypeError) as e:
            raise serializers.ValidationError({
                "file_data": f"Invalid Base64 format: {str(e)}"
            })

        # 2. Verify decoded byte stream is a valid ZIP archive
        try:
            zip_in_memory = io.BytesIO(decoded_bytes)
            # zipfile.is_zipfile checks headers
            if not zipfile.is_zipfile(zip_in_memory):
                raise serializers.ValidationError({
                    "file_data": "The decoded file stream is not a valid ZIP archive."
                })
            
            with zipfile.ZipFile(zip_in_memory) as zip_file:
                namelist = zip_file.namelist()
                
                # 3. Check for top-level directory 'source/'
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
                    raise serializers.ValidationError({
                        "file_data": "Missing 'source/' top-level directory inside the ZIP archive."
                    })

                # 4. Enforce exactly one .gdb directory inside source/
                if len(gdb_folders) == 0:
                    raise serializers.ValidationError({
                        "file_data": "No '.gdb' directory found inside the 'source/' folder."
                    })
                elif len(gdb_folders) > 1:
                    raise serializers.ValidationError({
                        "file_data": f"Exactly one '.gdb' directory is required inside 'source/', but found {len(gdb_folders)}: {', '.join(sorted(gdb_folders))}."
                    })

        except zipfile.BadZipFile:
            raise serializers.ValidationError({
                "file_data": "The decoded file stream is a corrupted ZIP archive."
            })

        # Include success metadata inside validated data context
        attrs['success_message'] = "File validation passed successfully."
        return attrs
