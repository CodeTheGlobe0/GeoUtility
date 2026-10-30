from rest_framework import serializers

from admin_gis.models import AnalysisType, AssignAnalysisType

from .models import GISDatabaseConnection, User


def analysis_types_of(user):
    """The user's assigned analysis types as [{id, name}], DataQC first."""
    return [
        {'id': a.analysis_type_id, 'name': a.analysis_type.name}
        for a in user.analysis_type_assignments.select_related('analysis_type').order_by('analysis_type_id')
    ]


class AnalysisTypesMixin(serializers.Serializer):
    """
    Read: `analysis_types` = [{id, name}].
    Write: `analysis_type_ids` = [id, ...] replaces the user's assignments
    (staff/superusers only; omit it to leave assignments unchanged).
    """
    analysis_types = serializers.SerializerMethodField()
    analysis_type_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=AnalysisType.objects.all(), write_only=True, required=False
    )

    def get_analysis_types(self, user):
        return analysis_types_of(user)

    def validate_analysis_type_ids(self, value):
        request = self.context.get('request')
        if request and not (request.user.is_staff or request.user.is_superuser):
            raise serializers.ValidationError("Only staff or superusers can assign analysis types.")
        return value


class UserSerializer(AnalysisTypesMixin, serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'project', 'analysis_types', 'is_staff', 'is_superuser', 'date_joined']
        read_only_fields = ['id', 'date_joined']



class UserCreateSerializer(AnalysisTypesMixin, serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'project', 'analysis_types', 'analysis_type_ids', 'password', 'is_staff', 'is_superuser']

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.user:
            request_user = request.user
            # Only superusers can set is_superuser = True
            if attrs.get('is_superuser', False) and not request_user.is_superuser:
                raise serializers.ValidationError({"is_superuser": "Only superusers can assign superuser privileges."})
            # Only superusers can set is_staff = True
            if attrs.get('is_staff', False) and not request_user.is_superuser:
                raise serializers.ValidationError({"is_staff": "Only superusers can assign staff status."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        analysis_types = validated_data.pop('analysis_type_ids', None)
        # We manually instantiate so we can call set_password
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if analysis_types is not None:
            AssignAnalysisType.set_for_user(user, analysis_types)
        return user


class UserUpdateSerializer(AnalysisTypesMixin, serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'project', 'analysis_types', 'analysis_type_ids', 'password', 'is_staff', 'is_superuser']
        extra_kwargs = {
            'username': {'required': False},
            'email': {'required': False},
        }

    def validate(self, attrs):
        request = self.context.get('request')
        instance = self.instance
        
        if request and request.user and instance:
            request_user = request.user
            
            # Check is_staff modification
            is_staff_val = attrs.get('is_staff')
            if is_staff_val is not None and is_staff_val != instance.is_staff:
                if not request_user.is_superuser:
                    raise serializers.ValidationError({"is_staff": "Only superusers can change staff status."})
            
            # Check is_superuser modification
            is_superuser_val = attrs.get('is_superuser')
            if is_superuser_val is not None and is_superuser_val != instance.is_superuser:
                if not request_user.is_superuser:
                    raise serializers.ValidationError({"is_superuser": "Only superusers can change superuser status."})
                    
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        analysis_types = validated_data.pop('analysis_type_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if analysis_types is not None:
            AssignAnalysisType.set_for_user(instance, analysis_types)
        return instance


from django.contrib.auth import authenticate
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        # Check if user exists
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise AuthenticationFailed("User with this username does not exist.")

        # Check if user is active
        if not user.is_active:
            raise AuthenticationFailed("This user account is inactive.")

        # Authenticate credentials
        authenticated_user = authenticate(username=username, password=password)
        if authenticated_user is None:
            raise AuthenticationFailed("Incorrect password. Please try again.")

        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'project': self.user.project,
            'analysis_types': analysis_types_of(self.user),
            'is_staff': self.user.is_staff,
            'is_superuser': self.user.is_superuser,
        }
        return data


class GISDatabaseConnectionSerializer(serializers.ModelSerializer):
    """Used for list/retrieve. The password is never included in output."""

    class Meta:
        model = GISDatabaseConnection
        fields = ['id', 'gisdbtype', 'gisapplication', 'instance', 'database', 'username', 'projection', 'is_active', 'created_at', 'updated_at']
        read_only_fields = fields


class GISDatabaseConnectionCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = GISDatabaseConnection
        fields = ['id', 'gisdbtype', 'gisapplication', 'instance', 'database', 'username', 'password', 'projection', 'is_active']
        read_only_fields = ['id']


class GISDatabaseConnectionUpdateSerializer(serializers.ModelSerializer):
    # Optional on update: omit it in the request to leave the stored password unchanged.
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})

    class Meta:
        model = GISDatabaseConnection
        fields = ['id', 'gisdbtype', 'gisapplication', 'instance', 'database', 'username', 'password', 'projection', 'is_active']
        read_only_fields = ['id']
        extra_kwargs = {
            'gisdbtype': {'required': False},
            'gisapplication': {'required': False},
            'instance': {'required': False},
            'database': {'required': False},
            'username': {'required': False},
            'projection': {'required': False},
            'is_active': {'required': False},
        }

