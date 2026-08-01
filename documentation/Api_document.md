# GeoUtility GIS & Planning Portal API Documentation

This document contains a comprehensive specification of all authentication, user administration, and GIS data validation API endpoints available in the backend system.

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
11. [Data Process Validation](#11-data-process-validation)

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

*   **URL:** `/api/token/refresh/` (Note: Registered under root API path)
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
Allows staff or superusers to create new user accounts directly. However, assigning role privileges (`is_staff` or `is_superuser`) is strictly locked down to superusers.

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
  "is_staff": true,      // Allowed only if request user is superuser
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
If a regular staff user attempts to assign `is_staff = true` or `is_superuser = true`:
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "is_staff": [
        "Only superusers can assign staff status."
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
Updates specific user details. Modifying role privileges (`is_staff` or `is_superuser`) is strictly locked down to superusers.

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
  "is_staff": true // Will raise 400 Bad Request if requesting user is standard or staff user
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
If a non-superuser attempts to change `is_staff` or `is_superuser`:
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "is_staff": [
        "Only superusers can change staff status."
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

---

### 11. Data Process Validation
Decodes a Base64 encoded ZIP archive payload and validates that it contains a top-level directory named `source/` containing exactly one `.gdb` folder. The decoded archive must not exceed **20 MB**.

*   **URL:** `/api/data-process/validate/`
*   **Method:** `POST`
*   **Authentication:** Token-based (`IsAuthenticated`)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`
    *   `Content-Type: application/json`

#### Request Body
`file_type` must be exactly `"gdb"` or `"shp"` — any other value is rejected with a `400`. Note: the ZIP structure check itself is unchanged regardless of which value is chosen — it still requires `source/` with exactly one `.gdb` folder.
```json
{
  "user_id": "101",
  "temp_id": "sess_8892",
  "file_type": "gdb",
  "file_data": "UEsDBBQAAAAIAI9iW..." // Base64 encoded ZIP stream
}
```

#### Success Response
On success, the ZIP archive's contents are extracted to `MEDIA_ROOT/<authenticated_user_id>/<file_type>/<temp_id>/` and a `FileUploadRecord` row is created with `status=SUCCESS` pointing at that path (note: the folder's user segment is the **authenticated** user's ID from the JWT, not the `user_id` field in the request body; no date folder is used since `temp_id` is expected to already be unique per upload).
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "success": true,
      "message": "File validation passed successfully.",
      "data": {
        "user_id": "101",
        "temp_id": "sess_8892",
        "file_type": "gdb",
        "extracted_path": "5/gdb/sess_8892"
      },
      "errors": null
    }
    ```

#### Error Response (Invalid file_type)
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "\"gdb_zip\" is not a valid choice.",
      "data": null,
      "errors": {
        "file_type": [
          "\"gdb_zip\" is not a valid choice."
        ]
      }
    }
    ```

#### Validation Behavior: All Errors Are Reported Together
Aside from an invalid Base64 payload (which is a hard stop, since nothing else can be checked without decoded bytes), every other check runs independently and **all failures are collected into a single response** — the caller does not need to fix and resubmit one error at a time. The checks that can combine are: file size, ZIP format validity, missing `source/` directory, and missing/multiple `.gdb` folders.

#### Error Response (Invalid Base64 Data)
Hard stop — no other checks run.
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "Invalid Base64 format: Incorrect padding",
      "data": null,
      "errors": {
        "file_data": [
          "Invalid Base64 format: Incorrect padding"
        ]
      }
    }
    ```

#### Error Response (Multiple Issues Found In One Pass)
Example: the payload is oversized **and** the ZIP is missing its `source/` directory **and** has no `.gdb` folder.
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "3 validation errors occurred.",
      "data": null,
      "errors": {
        "file_data": [
          "File size exceeds the maximum allowed limit of 20 MB (received 24.13 MB).",
          "Missing 'source/' top-level directory inside the ZIP archive.",
          "No '.gdb' directory found inside the 'source/' folder."
        ]
      }
    }
    ```

#### Error Response (Corrupted ZIP or Invalid Headers)
If the ZIP itself is not valid/corrupted, structural checks (`source/`, `.gdb`) are skipped since the archive can't be opened — but the size error (if applicable) is still included alongside it.
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "The decoded file stream is not a valid ZIP archive.",
      "data": null,
      "errors": {
        "file_data": [
          "The decoded file stream is not a valid ZIP archive."
        ]
      }
    }
    ```

#### Error Response (Invalid GDB counts)
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "Exactly one '.gdb' directory is required inside 'source/', but found 2: first_dataset.gdb, second_dataset.gdb.",
      "data": null,
      "errors": {
        "file_data": [
          "Exactly one '.gdb' directory is required inside 'source/', but found 2: first_dataset.gdb, second_dataset.gdb."
        ]
      }
    }
    ```
