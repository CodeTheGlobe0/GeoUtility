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
