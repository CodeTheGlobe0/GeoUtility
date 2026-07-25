from django.contrib.auth.models import User
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'date_joined']
        read_only_fields = ['id', 'date_joined']



class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'password', 'is_staff', 'is_superuser']

    def validate(self, attrs):
        request = self.context.get('request')
        if request and request.user:
            request_user = request.user
            # Only superusers can set is_superuser = True
            if attrs.get('is_superuser', False) and not request_user.is_superuser:
                raise serializers.ValidationError({"is_superuser": "Only superusers can assign superuser privileges."})
            # Only staff or superusers can set is_staff = True
            if attrs.get('is_staff', False) and not (request_user.is_staff or request_user.is_superuser):
                raise serializers.ValidationError({"is_staff": "Only staff or superusers can assign staff status."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        # We manually instantiate so we can call set_password
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'password', 'is_staff', 'is_superuser']
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
                if not (request_user.is_staff or request_user.is_superuser):
                    raise serializers.ValidationError({"is_staff": "Only staff or superusers can change staff status."})
            
            # Check is_superuser modification
            is_superuser_val = attrs.get('is_superuser')
            if is_superuser_val is not None and is_superuser_val != instance.is_superuser:
                if not request_user.is_superuser:
                    raise serializers.ValidationError({"is_superuser": "Only superusers can change superuser status."})
                    
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'is_staff': self.user.is_staff,
            'is_superuser': self.user.is_superuser,
        }
        return data

