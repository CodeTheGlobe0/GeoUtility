from django.contrib import admin

from .models import AnalysisType, AssignAnalysisType


@admin.register(AnalysisType)
class AnalysisTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")


@admin.register(AssignAnalysisType)
class AssignAnalysisTypeAdmin(admin.ModelAdmin):
    list_display = ("user", "analysis_type", "created_at")
    list_filter = ("analysis_type",)
    search_fields = ("user__username", "user__email")
