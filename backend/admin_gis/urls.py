from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AnalysisTypeViewSet, AssignAnalysisTypeViewSet

router = DefaultRouter()
router.register(r'analysis-types', AnalysisTypeViewSet, basename='analysis-type')
router.register(r'assignments', AssignAnalysisTypeViewSet, basename='analysis-type-assignment')

urlpatterns = [
    path('', include(router.urls)),
]
