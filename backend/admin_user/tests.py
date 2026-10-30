from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import OutstandingToken, BlacklistedToken

User = get_user_model()

class UserAuthAndManagementTests(APITestCase):

    def setUp(self):
        # Create a regular user
        self.regular_user = User.objects.create_user(
            username="regular_user",
            email="regular@example.com",
            password="Password123"
        )
        
        # Create another regular user
        self.other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="Password123"
        )

        # Create a superuser
        self.superuser = User.objects.create_superuser(
            username="admin_user",
            email="admin@example.com",
            password="AdminPassword123"
        )

        # URL Endpoints
        self.login_url = reverse('auth_login')
        self.logout_url = reverse('auth_logout')
        self.user_list_url = reverse('user-list')
        self.user_detail_url = lambda pk: reverse('user-detail', args=[pk])
        self.me_url = reverse('user-me')

    def test_public_registration_not_available(self):
        """
        Public registration endpoint should not be available.
        """
        response = self.client.post("/api/auth/register/", {
            "username": "new_signup",
            "password": "NewPassword123"
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_login_returns_tokens_and_metadata(self):
        """
        Login should return tokens and user profile information.
        """
        data = {
            "username": "regular_user",
            "password": "Password123"
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify tokens
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        
        # Verify user metadata
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["username"], "regular_user")
        self.assertFalse(response.data["user"]["is_staff"])
        self.assertFalse(response.data["user"]["is_superuser"])

    def test_login_invalid_username(self):
        """
        Login with a non-existent username should return 401 with a specific error message.
        """
        data = {
            "username": "does_not_exist",
            "password": "Password123"
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "User with this username does not exist.")

    def test_login_incorrect_password(self):
        """
        Login with an incorrect password should return 401 with a specific error message.
        """
        data = {
            "username": "regular_user",
            "password": "WrongPassword123"
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "Incorrect password. Please try again.")

    def test_regular_user_cannot_view_user_list(self):
        """
        A regular user should be forbidden from listing all users.
        """
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(self.user_list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_user_can_view_user_list(self):
        """
        Staff or superuser should be allowed to view the user list.
        """
        self.client.force_authenticate(user=self.superuser)
        response = self.client.get(self.user_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return at least 3 users (regular_user, other_user, superuser)
        self.assertGreaterEqual(len(response.data), 3)

    def test_regular_user_cannot_promote_themselves(self):
        """
        A regular user should not be able to set is_staff or is_superuser to True.
        """
        self.client.force_authenticate(user=self.regular_user)
        
        # Attempt to make self a superuser/staff
        data = {
            "is_staff": True,
            "is_superuser": True
        }
        response = self.client.patch(self.user_detail_url(self.regular_user.pk), data)
        # Should raise a validation error
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_staff", response.data)

        # Verify database was not updated
        self.regular_user.refresh_from_db()
        self.assertFalse(self.regular_user.is_staff)
        self.assertFalse(self.regular_user.is_superuser)

    def test_regular_user_cannot_update_other_users(self):
        """
        A regular user should not be allowed to modify other users.
        """
        self.client.force_authenticate(user=self.regular_user)
        data = {
            "first_name": "Malicious"
        }
        response = self.client.patch(self.user_detail_url(self.other_user.pk), data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_regular_user_can_update_self_without_role_change(self):
        """
        A regular user can update their own personal details.
        """
        self.client.force_authenticate(user=self.regular_user)
        data = {
            "first_name": "UpdatedName",
            "last_name": "UpdatedLastName"
        }
        response = self.client.patch(self.user_detail_url(self.regular_user.pk), data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.regular_user.refresh_from_db()
        self.assertEqual(self.regular_user.first_name, "UpdatedName")

    def test_admin_can_promote_user(self):
        """
        A superuser should be allowed to assign staff and superuser roles.
        """
        self.client.force_authenticate(user=self.superuser)
        data = {
            "is_staff": True,
            "is_superuser": True
        }
        response = self.client.patch(self.user_detail_url(self.regular_user.pk), data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify promotion succeeded
        self.regular_user.refresh_from_db()
        self.assertTrue(self.regular_user.is_staff)
        self.assertTrue(self.regular_user.is_superuser)

    def test_staff_cannot_assign_roles(self):
        """
        A staff user (not superuser) should not be allowed to assign is_staff=True or is_superuser=True.
        """
        staff_user = User.objects.create_user(
            username="staff_user",
            email="staff@example.com",
            password="StaffPassword123",
            is_staff=True
        )
        self.client.force_authenticate(user=staff_user)

        # 1. Attempt to create a user with is_staff=True (should fail)
        create_data = {
            "username": "new_staff_by_staff",
            "password": "Password123",
            "is_staff": True
        }
        response = self.client.post(self.user_list_url, create_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_staff", response.data)

        # 2. Attempt to update a user to is_staff=True (should fail)
        update_data = {
            "is_staff": True
        }
        response = self.client.patch(self.user_detail_url(self.regular_user.pk), update_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_staff", response.data)

    def test_logout_blacklists_token(self):
        """
        Logging out should blacklist the refresh token.
        """
        # Login to get a refresh token
        login_data = {
            "username": "regular_user",
            "password": "Password123"
        }
        login_response = self.client.post(self.login_url, login_data)
        refresh_token = login_response.data["refresh"]
        access_token = login_response.data["access"]

        # Authenticate with access token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        
        # Logout post request
        logout_response = self.client.post(self.logout_url, {"refresh": refresh_token})
        self.assertEqual(logout_response.status_code, status.HTTP_205_RESET_CONTENT)

        # Try to use refresh token again to get a new access token (should fail)
        refresh_url = reverse('token_refresh')
        refresh_response = self.client.post(refresh_url, {"refresh": refresh_token})
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)
