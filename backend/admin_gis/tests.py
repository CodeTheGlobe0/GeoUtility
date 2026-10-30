from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AnalysisType, AssignAnalysisType

User = get_user_model()


class AnalysisTypeApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='boss', password='pw-12345!')
        self.user = User.objects.create_user(username='worker', password='pw-12345!')
        self.dataqc, self.survey, self.production, self.edit = AnalysisType.objects.all()

    def test_seeded_types_in_order(self):
        self.client.force_authenticate(self.user)
        response = self.client.get('/api/admin-gis/analysis-types/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([t['name'] for t in response.data], ['DataQC', 'Survey', 'Production', 'Edit'])

    def test_regular_user_cannot_create_type(self):
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/admin-gis/analysis-types/', {'name': 'Audit'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_creates_type(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/admin-gis/analysis-types/', {'name': 'Audit'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_assignments_are_staff_only(self):
        self.client.force_authenticate(self.user)
        response = self.client.get('/api/admin-gis/assignments/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_assignment_filter_by_user(self):
        AssignAnalysisType.objects.create(user=self.user, analysis_type=self.survey)
        AssignAnalysisType.objects.create(user=self.admin, analysis_type=self.dataqc)
        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/admin-gis/assignments/?user={self.user.id}')
        self.assertEqual([a['analysis_type_name'] for a in response.data], ['Survey'])


class UserAnalysisTypeTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username='boss', password='pw-12345!')
        self.user = User.objects.create_user(username='worker', password='pw-12345!')
        self.dataqc, self.survey, self.production, self.edit = AnalysisType.objects.all()

    def test_superuser_sets_and_replaces_user_types(self):
        self.client.force_authenticate(self.admin)
        url = f'/api/auth/users/{self.user.id}/'
        response = self.client.patch(url, {'analysis_type_ids': [self.survey.id, self.dataqc.id]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([t['name'] for t in response.data['analysis_types']], ['DataQC', 'Survey'])

        response = self.client.patch(url, {'analysis_type_ids': [self.production.id]}, format='json')
        self.assertEqual([t['name'] for t in response.data['analysis_types']], ['Production'])
        self.assertEqual(AssignAnalysisType.objects.filter(user=self.user).count(), 1)

    def test_omitting_ids_keeps_assignments(self):
        AssignAnalysisType.objects.create(user=self.user, analysis_type=self.survey)
        self.client.force_authenticate(self.admin)
        self.client.patch(f'/api/auth/users/{self.user.id}/', {'first_name': 'W'}, format='json')
        self.assertEqual(AssignAnalysisType.objects.filter(user=self.user).count(), 1)

    def test_user_cannot_assign_own_types(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch('/api/auth/users/me/', {'analysis_type_ids': [self.dataqc.id]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AssignAnalysisType.objects.filter(user=self.user).exists())

    def test_create_user_with_types_and_login_returns_them(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/auth/users/', {
            'username': 'newbie', 'password': 'pw-12345!', 'analysis_type_ids': [self.production.id],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual([t['name'] for t in response.data['analysis_types']], ['Production'])

        self.client.force_authenticate(None)
        response = self.client.post('/api/auth/login/', {'username': 'newbie', 'password': 'pw-12345!'})
        self.assertEqual([t['name'] for t in response.data['user']['analysis_types']], ['Production'])
