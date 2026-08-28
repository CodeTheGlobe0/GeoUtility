from django.contrib.auth.models import User
from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import GISDatabaseConnection
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    CustomTokenObtainPairSerializer,
    GISDatabaseConnectionSerializer,
    GISDatabaseConnectionCreateSerializer,
    GISDatabaseConnectionUpdateSerializer,
)

# Custom Permission Classes
class IsStaffOrSuperuser(permissions.BasePermission):
    """
    Allows access only to staff or superusers.
    """
    def has_permission(self, request, view):
        return request.user and (request.user.is_staff or request.user.is_superuser)


class IsStaffOrSuperuserOrSelf(permissions.BasePermission):
    """
    Allows object access to staff/superusers, or the user themselves.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user:
            return False
        # Staff and superusers have full access
        if request.user.is_staff or request.user.is_superuser:
            return True
        # Regular users can only access their own user object
        return obj == request.user


# Auth Views


class CustomLoginView(TokenObtainPairView):
    """
    Custom login endpoint returning JWT tokens and user details.
    """
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    """
    Logout view to blacklist the refresh token.
    """
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


# User Management ViewSet
class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    - list, create, destroy: Staff/Superusers only.
    - retrieve, update, partial_update: Staff/Superusers, or the user themselves.
    """
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
        """
        Endpoint to retrieve/update the currently authenticated user.
        """
        user = request.user
        if request.method == 'GET':
            serializer = UserSerializer(user)
            return Response(serializer.data)
        else:
            # Partial update supported
            serializer = UserUpdateSerializer(user, data=request.data, partial=True, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)


class GISDatabaseConnectionViewSet(viewsets.ModelViewSet):
    """
    CRUD for GIS database connection configs (SQLSERVER/POSTGRES/ORACLE).
    Staff/Superusers only, since these are infrastructure credentials.
    """
    queryset = GISDatabaseConnection.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsStaffOrSuperuser]

    def get_serializer_class(self):
        if self.action == 'create':
            return GISDatabaseConnectionCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return GISDatabaseConnectionUpdateSerializer
        return GISDatabaseConnectionSerializer
