from django.urls import path
from .views import DataValidateView, UploadListView, UploadGeoJSONView, UploadDetailView

urlpatterns = [
    path('validate/', DataValidateView.as_view(), name='data_validate'),
    path('uploads/', UploadListView.as_view(), name='upload_list'),
    path('uploads/<int:pk>/', UploadDetailView.as_view(), name='upload_detail'),
    path('uploads/<int:pk>/geojson/', UploadGeoJSONView.as_view(), name='upload_geojson'),
]
