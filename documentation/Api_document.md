# GeoUtility Authentication & User Management API Documentation

This document contains a comprehensive specification of all authentication and user administration API endpoints available in the backend system.

**Base URL Path:** `/api/auth/` (Unless specified otherwise)

---

## Table of Contents
1. [User Login](#1-user-login)
2. [User Logout](#2-user-logout)
3. [Token Refresh](#3-token-refresh)
4. [Get Current User Profile (`/me/`)](#4-get-current-user-profile-me)
5. [Update Current User Profile (`/me/`)](#5-update-current-user-profile-me)
6. [List Users](#6-list-users)
7. [Create User (Admin)](#7-create-user-admin)
8. [Retrieve User Details](#8-retrieve-user-details)
9. [Update User Details](#9-update-user-details)
10. [Delete User](#10-delete-user)

---

## Endpoints Specification

### 1. User Login
Authenticates user credentials and returns both JWT tokens (access + refresh) and the user's profile metadata.

*   **URL:** `/api/auth/login/`
*   **Method:** `POST`
*   **Authentication:** None (`AllowAny`)
*   **Headers:**
    *   `Content-Type: application/json`

#### Request Body
```json
{
  "username": "john_doe",
  "password": "securepassword"
}
```

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIj...",
      "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIj...",
      "user": {
        "id": 5,
        "username": "john_doe",
        "email": "john@example.com",
        "is_staff": false,
        "is_superuser": false
      }
    }
    ```

#### Error Response (Invalid Credentials)
*   **Status Code:** `401 Unauthorized`
*   **Response Body:**
    ```json
    {
      "detail": "No active user found with the given credentials"
    }
    ```

---

### 2. User Logout
Logs the user out by blacklisting their current refresh token. The blacklisted token cannot be used again to request new access tokens.

*   **URL:** `/api/auth/logout/`
*   **Method:** `POST`
*   **Authentication:** Token-based (`IsAuthenticated`)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`
    *   `Content-Type: application/json`

#### Request Body
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIj..." // Required (string)
}
```

#### Success Response
*   **Status Code:** `205 Reset Content`
*   **Response Body:**
    ```json
    {
      "detail": "Successfully logged out."
    }
    ```

#### Error Response (Missing Token)
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "error": "Refresh token is required."
    }
    ```

#### Error Response (Token Blacklisted/Invalidated)
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "error": "Token is blacklisted"
    }
    ```

---

### 3. Token Refresh
Generates a new short-lived access token using a valid, active refresh token.

*   **URL:** `/api/token/refresh/` (Note: Registered under root api path)
*   **Method:** `POST`
*   **Authentication:** None (`AllowAny`)
*   **Headers:**
    *   `Content-Type: application/json`

#### Request Body
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIj..." // Required (string)
}
```

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIj..."
    }
    ```

---

### 4. Get Current User Profile (`/me/`)
Retrieves the logged-in user's profile details using their auth token context.

*   **URL:** `/api/auth/users/me/`
*   **Method:** `GET`
*   **Authentication:** Token-based (`IsAuthenticated`)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "id": 5,
      "username": "john_doe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_staff": false,
      "is_superuser": false,
      "date_joined": "2026-07-25T13:10:00Z"
    }
    ```

---

### 5. Update Current User Profile (`/me/`)
Updates details of the currently logged-in user's profile.

*   **URL:** `/api/auth/users/me/`
*   **Method:** `PUT` (Full Update) or `PATCH` (Partial Update)
*   **Authentication:** Token-based (`IsAuthenticated`)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`
    *   `Content-Type: application/json`

#### Request Body (All Fields Optional for PATCH)
```json
{
  "first_name": "Johnny",
  "last_name": "Doe",
  "email": "johnny@example.com",
  "password": "NewSecurePassword123"
}
```
*(Note: Passing `is_staff` or `is_superuser` values will result in a `400 Bad Request` block).*

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "id": 5,
      "username": "john_doe",
      "email": "johnny@example.com",
      "first_name": "Johnny",
      "last_name": "Doe",
      "is_staff": false,
      "is_superuser": false
    }
    ```

---

### 6. List Users
Returns a listing of all users in the system.

*   **URL:** `/api/auth/users/`
*   **Method:** `GET`
*   **Authentication:** Staff or Superusers only (`IsAdminUser` validation)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    [
      {
        "id": 1,
        "username": "admin_user",
        "email": "admin@example.com",
        "first_name": "",
        "last_name": "",
        "is_staff": true,
        "is_superuser": true,
        "date_joined": "2026-07-25T13:00:00Z"
      },
      {
        "id": 5,
        "username": "john_doe",
        "email": "johnny@example.com",
        "first_name": "Johnny",
        "last_name": "Doe",
        "is_staff": false,
        "is_superuser": false,
        "date_joined": "2026-07-25T13:10:00Z"
      }
    ]
    ```

#### Error Response (Non-Admin Request)
*   **Status Code:** `403 Forbidden`
*   **Response Body:**
    ```json
    {
      "detail": "You do not have permission to perform this action."
    }
    ```

---

### 7. Create User (Admin)
Allows staff or superusers to create new user accounts directly and assign roles.

*   **URL:** `/api/auth/users/`
*   **Method:** `POST`
*   **Authentication:** Staff or Superusers only
*   **Headers:**
    *   `Authorization: Bearer <access_token>`
    *   `Content-Type: application/json`

#### Request Body
```json
{
  "username": "manager_alice",
  "password": "AlicePassword123",
  "email": "alice@example.com",
  "is_staff": true,      // Allowed if request user is staff or superuser
  "is_superuser": false  // Allowed only if request user is superuser
}
```

#### Success Response
*   **Status Code:** `201 Created`
*   **Response Body:**
    ```json
    {
      "id": 6,
      "username": "manager_alice",
      "email": "alice@example.com",
      "first_name": "",
      "last_name": "",
      "is_staff": true,
      "is_superuser": false
    }
    ```

#### Error Response (Privilege Escalation Attempt)
If a regular staff user attempts to assign `is_superuser = true`:
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "is_superuser": [
        "Only superusers can assign superuser privileges."
      ]
    }
    ```

---

### 8. Retrieve User Details
Fetches profile details of a specific user.

*   **URL:** `/api/auth/users/<id>/` (Example: `/api/auth/users/5/`)
*   **Method:** `GET`
*   **Authentication:** Staff or Superusers, or the target user themselves (`IsStaffOrSuperuserOrSelf` constraint)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "id": 5,
      "username": "john_doe",
      "email": "johnny@example.com",
      "first_name": "Johnny",
      "last_name": "Doe",
      "is_staff": false,
      "is_superuser": false,
      "date_joined": "2026-07-25T13:10:00Z"
    }
    ```

#### Error Response (Accessing Another User's Profile)
If user `john_doe` (ID 5) tries to access `/api/auth/users/6/`:
*   **Status Code:** `403 Forbidden`
*   **Response Body:**
    ```json
    {
      "detail": "You do not have permission to perform this action."
    }
    ```

---

### 9. Update User Details
Updates specific user details. Supporting privilege promotion checks.

*   **URL:** `/api/auth/users/<id>/` (Example: `/api/auth/users/5/`)
*   **Method:** `PUT` or `PATCH`
*   **Authentication:** Staff or Superusers, or the target user themselves
*   **Headers:**
    *   `Authorization: Bearer <access_token>`
    *   `Content-Type: application/json`

#### Request Body (All Fields Optional for PATCH)
```json
{
  "first_name": "John",
  "is_staff": true // Will raise 400 Bad Request if requesting user is standard user
}
```

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "id": 5,
      "username": "john_doe",
      "email": "johnny@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_staff": true,
      "is_superuser": false
    }
    ```

#### Error Response (Unauthorized Promotion)
If a regular user (or non-superuser staff) attempts to change `is_superuser`:
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "is_superuser": [
        "Only superusers can change superuser status."
      ]
    }
    ```

---

### 10. Delete User
Deletes a user account.

*   **URL:** `/api/auth/users/<id>/` (Example: `/api/auth/users/5/`)
*   **Method:** `DELETE`
*   **Authentication:** Staff or Superusers only
*   **Headers:**
    *   `Authorization: Bearer <access_token>`

#### Success Response
*   **Status Code:** `204 No Content`
*   **Response Body:** (Empty response body)
