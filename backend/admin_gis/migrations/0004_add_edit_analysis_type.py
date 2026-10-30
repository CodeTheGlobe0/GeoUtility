from django.db import migrations

# Added after the first three, so it lists last (types sort by creation order).
NAME = "Edit"


def create_edit_type(apps, schema_editor):
    AnalysisType = apps.get_model("admin_gis", "AnalysisType")
    AnalysisType.objects.get_or_create(name=NAME)


def remove_edit_type(apps, schema_editor):
    AnalysisType = apps.get_model("admin_gis", "AnalysisType")
    AnalysisType.objects.filter(name=NAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("admin_gis", "0003_assignanalysistype"),
    ]

    operations = [
        migrations.RunPython(create_edit_type, remove_edit_type),
    ]
