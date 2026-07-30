from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .serializers import DataValidateSerializer

class DataValidateView(APIView):
    """
    API endpoint to execute validation checks on uploaded Base64 zip payloads.
    Requires user authentication via JWT.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request) -> Response:
        """
        Validate zip file schema data payload.
        """
        serializer = DataValidateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            return Response({
                "status": "success",
                "message": data.get("success_message"),
                "user_id": data.get("user_id"),
                "temp_id": data.get("temp_id"),
                "file_type": data.get("file_type")
            }, status=status.HTTP_200_OK)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
