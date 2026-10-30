from django.contrib.auth.models import AbstractUser
from django.db import models, transaction

from .fields import EncryptedCharField


class User(AbstractUser):
    """The project's user model (AUTH_USER_MODEL): Django's user plus a project."""
    project = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Project this user works on.",
    )


class GISDatabaseConnection(models.Model):
    """
    Connection details for an external GIS database (SQL Server, PostgreSQL,
    or Oracle) that other parts of the system can read spatial data from.
    """
    DB_TYPE_CHOICES = [
        ('SQLSERVER', 'SQL Server'),
        ('POSTGRES', 'PostgreSQL'),
        ('ORACLE', 'Oracle'),
    ]

    gisdbtype = models.CharField(
        max_length=20,
        choices=DB_TYPE_CHOICES,
        help_text="Type of GIS database engine.",
    )
    gisapplication = models.CharField(
        max_length=255,
        help_text="GIS application this connection is used with, e.g. 'ArcGIS', 'QGIS'.",
    )
    instance = models.CharField(
        max_length=255,
        help_text="Server/instance host (and port, if applicable).",
    )
    database = models.CharField(
        max_length=255,
        help_text="Database name.",
    )
    username = models.CharField(
        max_length=255,
        help_text="Connection username.",
    )
    password = EncryptedCharField(
        max_length=500,
        help_text="Connection password, encrypted at rest.",
    )
    projection = models.CharField(
        max_length=100,
        help_text="Default spatial reference/projection, e.g. 'EPSG:4326'.",
    )
    is_active = models.BooleanField(
        default=False,
        help_text="Only one connection can be active at a time — the one the "
                   "rest of the system reads spatial data from. Activating this "
                   "one automatically deactivates every other connection.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.gisapplication} - {self.gisdbtype} - {self.instance}/{self.database}"

    def save(self, *args, **kwargs):
        if self.is_active:
            with transaction.atomic():
                GISDatabaseConnection.objects.exclude(pk=self.pk).update(is_active=False)
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)
