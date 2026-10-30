from django.conf import settings
from django.db import models


class AnalysisType(models.Model):
    """
    A kind of GIS analysis work (DataQC, Survey, Production).
    The three defaults are created by migration 0002.
    """
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Analysis type name, e.g. 'DataQC'.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # creation order, so the seeded DataQC comes first
        ordering = ["id"]

    def __str__(self) -> str:
        return self.name


class AssignAnalysisType(models.Model):
    """
    Assigns an AnalysisType to a user. A user can hold several types, but
    each type only once.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="analysis_type_assignments",
        help_text="User the analysis type is assigned to.",
    )
    analysis_type = models.ForeignKey(
        AnalysisType,
        on_delete=models.CASCADE,
        related_name="assignments",
        help_text="Analysis type assigned to the user.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user_id", "analysis_type_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "analysis_type"],
                name="unique_user_analysis_type",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} - {self.analysis_type}"

    @classmethod
    def set_for_user(cls, user, analysis_types):
        """Make `analysis_types` exactly the user's assigned types."""
        wanted = {t.pk for t in analysis_types}
        cls.objects.filter(user=user).exclude(analysis_type_id__in=wanted).delete()
        have = set(cls.objects.filter(user=user).values_list("analysis_type_id", flat=True))
        cls.objects.bulk_create(cls(user=user, analysis_type_id=pk) for pk in wanted - have)
