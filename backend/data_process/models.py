import os
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

def get_upload_path(instance, filename: str) -> str:
    """
    Helper function to generate the dynamic upload path:
    upload-{user_id}-{YYYYMMDD_HHMMSS}-{temp_id}/<filename>
    """
    # Use instance created_at if set, otherwise fallback to current time
    now = instance.created_at or timezone.now()
    timestamp = now.strftime('%Y%m%d_%H%M%S')
    
    # Get user identifier
    user_id_str = str(instance.user.id) if instance.user else "anonymous"
    
    # Sanitize the filename to prevent path traversal issues
    clean_filename = os.path.basename(filename)
    
    return f"upload-{user_id_str}-{timestamp}-{instance.temp_id}/{clean_filename}"

class FileUploadRecord(models.Model):
    """
    Database model to track file processing runs, validation statuses, and errors.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('VALIDATING', 'Validating'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='file_uploads',
        help_text="The administrative user who uploaded the file."
    )
    temp_id = models.CharField(
        max_length=255,
        help_text="Temporary transaction or session identifier."
    )
    file_type = models.CharField(
        max_length=50,
        help_text="Expected extension or format indicator (e.g., '.shp', '.gdb')."
    )
    file_path = models.FileField(
        upload_to=get_upload_path,
        max_length=500,
        help_text="Storage path for the uploaded ZIP archive."
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        help_text="Current execution state of the processing run."
    )
    status_message = models.TextField(
        blank=True,
        null=True,
        help_text="Stores detailed validation errors or success details."
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Auto-set when the record is created."
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Auto-updated whenever the record is modified."
    )

    class Meta:
        # Define indexes on user, temp_id, and created_at for fast queries
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['temp_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self) -> str:
        return f"UploadRecord {self.id} | User: {self.user.username} | Status: {self.status}"
