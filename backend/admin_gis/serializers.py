from rest_framework import serializers

from .models import AnalysisType, AssignAnalysisType


class AnalysisTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisType
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AssignAnalysisTypeSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    analysis_type_name = serializers.CharField(source='analysis_type.name', read_only=True)

    class Meta:
        model = AssignAnalysisType
        fields = ['id', 'user', 'username', 'analysis_type', 'analysis_type_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
