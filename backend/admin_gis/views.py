from rest_framework import permissions, viewsets

from admin_user.views import IsStaffOrSuperuser

from .models import AnalysisType, AssignAnalysisType
from .serializers import AnalysisTypeSerializer, AssignAnalysisTypeSerializer


class AnalysisTypeViewSet(viewsets.ModelViewSet):
    """
    Analysis types (DataQC, Survey, Production).
    - list, retrieve: any signed-in user (the frontend needs the names).
    - create, update, destroy: Staff/Superusers only.
    """
    queryset = AnalysisType.objects.all()
    serializer_class = AnalysisTypeSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsStaffOrSuperuser()]


class AssignAnalysisTypeViewSet(viewsets.ModelViewSet):
    """
    Which user has which analysis type. Staff/Superusers only.
    Filter with ?user=<id> or ?analysis_type=<id>.
    """
    serializer_class = AssignAnalysisTypeSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffOrSuperuser]

    def get_queryset(self):
        qs = AssignAnalysisType.objects.select_related('user', 'analysis_type')
        user_id = self.request.query_params.get('user')
        type_id = self.request.query_params.get('analysis_type')
        if user_id:
            qs = qs.filter(user_id=user_id)
        if type_id:
            qs = qs.filter(analysis_type_id=type_id)
        return qs
