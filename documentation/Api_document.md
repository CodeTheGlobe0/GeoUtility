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
12. [List Uploads](#12-list-uploads)
13. [Get Upload GeoJSON](#13-get-upload-geojson)
14. [Update Upload](#14-update-upload)
15. [Delete Upload](#15-delete-upload)

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
Decodes a Base64 encoded ZIP archive payload and validates its structure based on `file_type`. The decoded archive must not exceed **20 MB**. See `documentation/data_process_flow.md` for a full code-level walkthrough with diagrams.

*   **URL:** `/api/data-process/validate/`
*   **Method:** `POST`
*   **Authentication:** Token-based (`IsAuthenticated`)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`
    *   `Content-Type: application/json`

#### Request Body
`file_type` must be exactly `"gdb"` or `"shp"` — any other value is rejected with a `400`. The ZIP structure check depends on which value is chosen:
- `"gdb"` — the ZIP must contain a top-level `source/` folder with **exactly one** `<name>.gdb` directory inside it.
- `"shp"` — the ZIP must contain a top-level `source/` folder with **at least one** `<name>.shp` file anywhere inside it, **including subfolders** (multiple are allowed, e.g. one per country/region, each in its own subfolder). Every `.shp` found must have its own required `.shx` and `.dbf` sibling files alongside it.

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
Aside from an invalid Base64 payload (which is a hard stop, since nothing else can be checked without decoded bytes), every other check runs independently and **all failures are collected into a single response** — the caller does not need to fix and resubmit one error at a time. File size and ZIP-format-validity can combine with any structural error. The structural checks themselves are mutually exclusive per request: if `source/` is missing, the `.gdb`/`.shp` check is skipped entirely (there's nothing to look inside); otherwise exactly one of the `.gdb` or `.shp` checks runs, based on `file_type`.

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
Example: the payload is oversized **and** the ZIP is missing its `source/` directory.
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "2 validation errors occurred.",
      "data": null,
      "errors": {
        "file_data": [
          "File size exceeds the maximum allowed limit of 20 MB (received 24.13 MB).",
          "Missing 'source/' top-level directory inside the ZIP archive."
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

#### Error Response (Invalid `.gdb` counts — `file_type: "gdb"`)
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

#### Error Response (Incomplete Shapefile — `file_type: "shp"`)
The `.shp` file was found but its required `.shx`/`.dbf` siblings were missing.
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "Shapefile 'roads' is missing required file(s): .dbf, .shx.",
      "data": null,
      "errors": {
        "file_data": [
          "Shapefile 'roads' is missing required file(s): .dbf, .shx."
        ]
      }
    }
    ```

---

### 12. List Uploads
Returns upload history, most recent first, scoped by role:
- **Admins (`is_superuser`)** see every user's uploads.
- **Everyone else (staff or regular users)** only see their own.

Every `FileUploadRecord` the caller is entitled to see is included regardless of status. Use the `id` of a record with `status: "SUCCESS"` to fetch its GeoJSON via endpoint 13.

*   **URL:** `/api/data-process/uploads/`
*   **Method:** `GET`
*   **Authentication:** Token-based (`IsAuthenticated`)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "success": true,
      "message": "1 upload(s) found.",
      "data": [
        {
          "id": 3,
          "username": "john_doe",
          "temp_id": "sess_8892",
          "file_type": "gdb",
          "status": "SUCCESS",
          "status_message": "File validation passed successfully.",
          "created_at": "2026-08-02T02:55:37.003488Z",
          "updated_at": "2026-08-02T02:55:37.003503Z"
        }
      ],
      "errors": null
    }
    ```

---

### 13. Get Upload GeoJSON
Reads the `.gdb` or `.shp`(s) behind a given upload and returns a dict keyed by feature class/layer name, each value a standalone GeoJSON `FeatureCollection` for that layer (for `.shp` uploads, one key per shapefile found anywhere inside `source/`, including subfolders — e.g. `ar`, `bo`, `cl`, ... if the upload contained one shapefile per country; a nested shapefile's key includes its sub-path, e.g. `asia/in`, so same-named files in different subfolders don't collide). Coordinates are reprojected to WGS84 (`EPSG:4326`) whenever the source layer has a known CRS; layers with no CRS defined are returned in their original coordinates unchanged.

**Access:** admins (`is_superuser`) can fetch any user's upload by id; everyone else (staff or regular users) can only fetch their own.

See `documentation/data_process_flow.md` for the full internal trace and diagrams of this endpoint.

*   **URL:** `/api/data-process/uploads/<id>/geojson/` (Example: `/api/data-process/uploads/3/geojson/`)
*   **Method:** `GET`
*   **Authentication:** Token-based (`IsAuthenticated`) — only the uploading user can access their own upload
*   **Headers:**
    *   `Authorization: Bearer <access_token>`

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "success": true,
      "message": "2 layer(s), 18 feature(s) extracted.",
      "data": {
        "PARCEL": {
          "type": "FeatureCollection",
          "features": [
            {
              "type": "Feature",
              "properties": { "PARCEL_ID": 12, "...": "..." },
              "geometry": { "type": "Polygon", "coordinates": [ ["..."] ] }
            }
          ]
        },
        "TRANSPORT_NETWORK": {
          "type": "FeatureCollection",
          "features": [
            {
              "type": "Feature",
              "properties": { "SectionId": "SBF3969_11 KV MAGADH MEDICAL2901", "...": "..." },
              "geometry": { "type": "LineString", "coordinates": [ ["..."] ] }
            }
          ]
        }
      },
      "errors": null
    }
    ```

#### Error Response (Not Found / Not Yours)
Returned identically whether the `id` doesn't exist or belongs to a different user — this avoids revealing which upload IDs exist.
*   **Status Code:** `404 Not Found`

#### Error Response (Upload Not Successfully Validated)
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "This upload has not completed successful validation/extraction.",
      "data": null,
      "errors": {
        "id": ["Upload status is 'VALIDATING', expected 'SUCCESS'."]
      }
    }
    ```

#### Error Response (Extracted Data Missing From Disk)
*   **Status Code:** `404 Not Found`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "Could not locate the extracted data source for this upload.",
      "data": null,
      "errors": {
        "id": ["Expected exactly one .gdb directory under '...', found 0."]
      }
    }
    ```

#### Error Response (File Exists But Couldn't Be Read)
*   **Status Code:** `422 Unprocessable Entity`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "Failed to read features from the uploaded data source.",
      "data": null,
      "errors": {
        "id": ["<underlying geopandas/pyogrio error message>"]
      }
    }
    ```

---

### 14. Update Upload
Replaces an existing upload's contents with a new base64-encoded zip, validated exactly the same way as a brand-new upload (see endpoint 11 — size limit, zip structure, `.gdb`/`.shp` rules all apply identically). The old extracted files are deleted from disk **before** the new archive is extracted in their place, so no leftover files from the previous version remain. `temp_id` cannot be changed — only `file_type` and `file_data` are accepted; the record being updated is identified by the URL's `<id>`.

**Access:** admins (`is_superuser`) can update any user's upload; everyone else (staff or regular users) can only update their own.

*   **URL:** `/api/data-process/uploads/<id>/` (Example: `/api/data-process/uploads/3/`)
*   **Method:** `PUT`
*   **Authentication:** Token-based (`IsAuthenticated`)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`
    *   `Content-Type: application/json`

#### Request Body
```json
{
  "file_type": "shp",
  "file_data": "UEsDBBQAAAAIAI9iW..." // Base64 encoded ZIP stream
}
```

#### Success Response
*   **Status Code:** `200 OK`
*   **Response Body:**
    ```json
    {
      "success": true,
      "message": "File validation passed successfully.",
      "data": {
        "id": 3,
        "temp_id": "sess_8892",
        "file_type": "shp",
        "extracted_path": "5/shp/sess_8892"
      },
      "errors": null
    }
    ```

#### Error Response (Not Found / Not Yours)
Returned identically whether the `id` doesn't exist or belongs to a different user.
*   **Status Code:** `404 Not Found`

#### Error Response (Invalid Zip Payload)
Same validation rules and error format as endpoint 11 (base64 decode failure is a hard stop; size, zip-format, and structure errors are otherwise combined into one response).
*   **Status Code:** `400 Bad Request`
*   **Response Body:**
    ```json
    {
      "success": false,
      "message": "No '.shp' file found inside the 'source/' folder.",
      "data": null,
      "errors": {
        "file_data": ["No '.shp' file found inside the 'source/' folder."]
      }
    }
    ```

---

### 15. Delete Upload
Deletes an upload's database record **and** removes its extracted files from disk.

**Access:** admins (`is_superuser`) can delete any user's upload; everyone else (staff or regular users) can only delete their own.

*   **URL:** `/api/data-process/uploads/<id>/` (Example: `/api/data-process/uploads/3/`)
*   **Method:** `DELETE`
*   **Authentication:** Token-based (`IsAuthenticated`)
*   **Headers:**
    *   `Authorization: Bearer <access_token>`

#### Success Response
*   **Status Code:** `204 No Content`
*   **Response Body:** (Empty response body)

#### Error Response (Not Found / Not Yours)
Returned identically whether the `id` doesn't exist or belongs to a different user.
*   **Status Code:** `404 Not Found`
