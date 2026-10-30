from django.db import migrations

# Created in this order, so DataQC lists first, then Survey, then Production.
DEFAULT_ANALYSIS_TYPES = ["DataQC", "Survey", "Production"]


def create_analysis_types(apps, schema_editor):
    AnalysisType = apps.get_model("admin_gis", "AnalysisType")
    for name in DEFAULT_ANALYSIS_TYPES:
        AnalysisType.objects.get_or_create(name=name)


def remove_analysis_types(apps, schema_editor):
    AnalysisType = apps.get_model("admin_gis", "AnalysisType")
    AnalysisType.objects.filter(name__in=DEFAULT_ANALYSIS_TYPES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("admin_gis", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_analysis_types, remove_analysis_types),
    ]
