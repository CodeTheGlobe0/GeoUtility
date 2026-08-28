from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomLoginView, LogoutView, UserViewSet, GISDatabaseConnectionViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'gis-connections', GISDatabaseConnectionViewSet, basename='gis-connection')

urlpatterns = [
    path('login/', CustomLoginView.as_view(), name='auth_login'),
    path('logout/', LogoutView.as_view(), name='auth_logout'),
    path('', include(router.urls)),
]
