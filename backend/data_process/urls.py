from django.urls import path
from .views import DataValidateView

urlpatterns = [
    path('validate/', DataValidateView.as_view(), name='data_validate'),
]
