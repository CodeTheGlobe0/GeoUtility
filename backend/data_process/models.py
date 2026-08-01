from django.db import models
from django.contrib.auth.models import User


def get_extraction_relative_path(instance) -> str:
    """
    Builds the relative (to MEDIA_ROOT) destination directory for a validated
    upload's extracted contents: <user_id>/<file_type>/<temp_id>/
    temp_id is expected to be unique per upload, so no separate date folder is needed.
    """
    user_id_str = str(instance.user.id) if instance.user else "anonymous"
    file_type_str = instance.file_type or "unknown"

    return f"{user_id_str}/{file_type_str}/{instance.temp_id}"

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
    extracted_path = models.CharField(
        max_length=500,
        help_text="Path (relative to MEDIA_ROOT) of the directory holding the extracted archive contents."
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
