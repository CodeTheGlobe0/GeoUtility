from django.urls import path
from .views import (
    DataValidateView, UploadListView, UploadGeoJSONView, UploadDetailView,
    LoadDataView, LoadDataColumnsView, LoadDataValuesView, UploadPushToDatabaseView,
)

urlpatterns = [
    path('validate/', DataValidateView.as_view(), name='data_validate'),
    path('uploads/', UploadListView.as_view(), name='upload_list'),
    path('uploads/<int:pk>/', UploadDetailView.as_view(), name='upload_detail'),
    path('uploads/<int:pk>/geojson/', UploadGeoJSONView.as_view(), name='upload_geojson'),
    path('uploads/<int:pk>/push-to-database/', UploadPushToDatabaseView.as_view(), name='upload_push_to_database'),
    path('load-data/', LoadDataView.as_view(), name='load_data'),
    path('load-data/columns/', LoadDataColumnsView.as_view(), name='load_data_columns'),
    path('load-data/values/', LoadDataValuesView.as_view(), name='load_data_values'),
]
