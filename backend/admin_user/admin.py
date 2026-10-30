from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class GlobeStackUserAdmin(UserAdmin):
    list_display = UserAdmin.list_display + ("project",)
    fieldsets = UserAdmin.fieldsets + (("Project", {"fields": ("project",)}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Project", {"fields": ("project",)}),)
