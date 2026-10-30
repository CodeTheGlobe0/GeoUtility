# Backend Setup from Scratch Guide

This step-by-step guide explains how the backend was set up from scratch, including packages installation, Django structure configuration, Celery/Redis integration, database migrations, and administrative user management APIs.

---

## Step 1: Initialize Project Directory & Environment

1. Create a `backend` directory and initialize it with Python 3.13 configuration (using the `uv` tool):
   ```bash
   mkdir backend
   cd backend
   uv init --app
   ```
   This creates a basic directory structure with:
   - `.python-version` (contains `3.13`)
   - `pyproject.toml` (bare dependencies list)
   - `README.md`
   - `main.py` (boilerplate main script)

2. Create a virtual environment:
   ```bash
   uv venv
   ```

---

## Step 2: Install Required Dependencies

Install Django, Django REST Framework (DRF), SimpleJWT (for authentication), Celery, the Redis Python client, and Django CORS headers:
```bash
uv add django djangorestframework djangorestframework-simplejwt celery redis django-cors-headers
```
This updates `pyproject.toml` and locks versions in `uv.lock`.

---

## Step 3: Initialize the Django Project

Initialize the Django project using `config` as the project configuration folder:
```bash
uv run django-admin startproject config .
```
This creates the following structure:
- `manage.py` (Django execution entry point)
- `config/`
  - `__init__.py`
  - `settings.py` (Core settings)
  - `urls.py` (Root URL configs)
  - `wsgi.py` / `asgi.py` (Server deployment entry points)

Remove the old boilerplate `main.py` as it is no longer needed:
```bash
rm main.py
```

---

## Step 4: Configure Celery and Redis

1. Create a new file `config/celery.py` to initialize the Celery application:
   ```python
   import os
   from celery import Celery

   os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
   app = Celery('config')
   app.config_from_object('django.conf:settings', namespace='CELERY')
   app.autodiscover_tasks()

   @app.task(bind=True, ignore_result=True)
   def debug_task(self):
       print(f'Request: {self.request!r}')
   ```

2. Update `config/__init__.py` to load the Celery app when Django starts:
   ```python
   from .celery import app as celery_app

   __all__ = ('celery_app',)
   ```

3. Open `config/settings.py` and append Celery settings to the bottom of the file:
   ```python
   # Celery Configuration
   CELERY_BROKER_URL = "redis://localhost:6379/0"
   CELERY_RESULT_BACKEND = "redis://localhost:6379/0"
   CELERY_ACCEPT_CONTENT = ["json"]
   CELERY_TASK_SERIALIZER = "json"
   CELERY_RESULT_SERIALIZER = "json"
   CELERY_TIMEZONE = TIME_ZONE
   ```

---

## Step 5: Configure Django Rest Framework & SimpleJWT

1. Open `config/settings.py` and register the apps in `INSTALLED_APPS`:
   ```python
   INSTALLED_APPS = [
       ...
       "rest_framework",
       "rest_framework_simplejwt",
       "rest_framework_simplejwt.token_blacklist", # Required to support secure logout
   ]
   ```

2. Append DRF and SimpleJWT configurations to the bottom of `config/settings.py`:
   ```python
   # Django REST Framework & JWT Configuration
    REST_FRAMEWORK = {
        "DEFAULT_AUTHENTICATION_CLASSES": (
            "rest_framework_simplejwt.authentication.JWTAuthentication",
        )
    }

    from datetime import timedelta
    SIMPLE_JWT = {
        "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
        "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
        "ROTATE_REFRESH_TOKENS": False,
        "BLACKLIST_AFTER_ROTATION": False,
        "UPDATE_LAST_LOGIN": False,
        "ALGORITHM": "HS256",
        "SIGNING_KEY": SECRET_KEY,
        "AUTH_HEADER_TYPES": ("Bearer",),
        "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
        "USER_ID_FIELD": "id",
        "USER_ID_CLAIM": "user_id",
    }
   ```

3. Configure CORS headers:
   Register `"corsheaders"` in `INSTALLED_APPS`:
   ```python
   INSTALLED_APPS = [
       ...
       "corsheaders",
       "rest_framework",
       "rest_framework_simplejwt",
       ...
   ]
   ```
   Add `"corsheaders.middleware.CorsMiddleware"` to `MIDDLEWARE` (must be placed before `CommonMiddleware`):
   ```python
   MIDDLEWARE = [
       "django.middleware.security.SecurityMiddleware",
       "django.contrib.sessions.middleware.SessionMiddleware",
       "corsheaders.middleware.CorsMiddleware",
       "django.middleware.common.CommonMiddleware",
       ...
   ]
   ```
   Append `CORS_ALLOWED_ORIGINS` to specify the React frontend development ports:
   ```python
   CORS_ALLOWED_ORIGINS = [
       "http://localhost:5173",
       "http://127.0.0.1:5173",
   ]
   ```

---

## Step 6: Create & Register the `admin_user` App

1. Generate the app structure:
   ```bash
   uv run python manage.py startapp admin_user
   ```

2. Register the app in `config/settings.py`:
   ```python
   INSTALLED_APPS = [
       ...
       "admin_user",
   ]
   ```

3. Run initial database migrations:
   ```bash
   uv run python manage.py migrate
   ```

---

## Step 7: Implement serializers in `admin_user`

Create `admin_user/serializers.py` to handle data serialization and validate role promotions (only staff/superusers can set role privileges):
```python
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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
            if attrs.get('is_superuser', False) and not request_user.is_superuser:
                raise serializers.ValidationError({"is_superuser": "Only superusers can assign superuser privileges."})
            if attrs.get('is_staff', False) and not (request_user.is_staff or request_user.is_superuser):
                raise serializers.ValidationError({"is_staff": "Only staff or superusers can assign staff status."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
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
            is_staff_val = attrs.get('is_staff')
            if is_staff_val is not None and is_staff_val != instance.is_staff:
                if not (request_user.is_staff or request_user.is_superuser):
                    raise serializers.ValidationError({"is_staff": "Only staff or superusers can change staff status."})
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
```

---

## Step 8: Implement Views in `admin_user`

Open `admin_user/views.py` and write the endpoints:
```python
from django.contrib.auth.models import User
from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    CustomTokenObtainPairSerializer
)

class IsStaffOrSuperuser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and (request.user.is_staff or request.user.is_superuser)

class IsStaffOrSuperuserOrSelf(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if not request.user:
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        return obj == request.user

class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
                return Response({"detail": "Successfully logged out."}, status=status.HTTP_205_RESET_CONTENT)
            return Response({"error": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('id')

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ['retrieve', 'update', 'partial_update']:
            return [permissions.IsAuthenticated(), IsStaffOrSuperuserOrSelf()]
        elif self.action in ['list', 'create', 'destroy']:
            return [permissions.IsAuthenticated(), IsStaffOrSuperuser()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get', 'put', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        user = request.user
        if request.method == 'GET':
            serializer = UserSerializer(user)
            return Response(serializer.data)
        else:
            serializer = UserUpdateSerializer(user, data=request.data, partial=True, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
```

---

## Step 9: Configure URL Routing

1. Create `admin_user/urls.py` to route requests:
   ```python
   from django.urls import path, include
   from rest_framework.routers import DefaultRouter
   from .views import CustomLoginView, LogoutView, UserViewSet

   router = DefaultRouter()
   router.register(r'users', UserViewSet, basename='user')

   urlpatterns = [
       path('login/', CustomLoginView.as_view(), name='auth_login'),
       path('logout/', LogoutView.as_view(), name='auth_logout'),
       path('', include(router.urls)),
   ]
   ```

2. Include these routes in `config/urls.py`:
   ```python
   from django.contrib import admin
   from django.urls import path, include
   from rest_framework_simplejwt.views import TokenRefreshView

   urlpatterns = [
       path("admin/", admin.site.urls),
       path("api/auth/", include("admin_user.urls")),
       path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
   ]
   ```

---

## Step 10: Export Requirements

To save only direct/primary requirements, write the list to `requirements.txt`:
```text
django>=6.0.7
djangorestframework>=3.17.1
djangorestframework-simplejwt>=5.5.1
celery>=5.6.3
redis>=8.0.1
```

---

## Step 11: Verification

Run internal checks and tests to verify:
```bash
uv run python manage.py check
uv run python manage.py test admin_user
```
