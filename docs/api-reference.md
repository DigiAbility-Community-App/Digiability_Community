# Digiability Community — Auth API Reference (`user-svc`)

> **Base URL:** `http://localhost:4001/api/auth`
> **Content-Type:** `application/json` (all POST/DELETE endpoints)
> **Cookie handling:** The backend uses `HttpOnly` cookies for refresh tokens — the frontend must send `credentials: "include"` (fetch) or `withCredentials: true` (axios) on every request.

---

## Standard Response Envelope

Every response follows this shape:

```jsonc
{
  "success": true | false,
  "message": "Human-readable description",
  "data": { ... },           // present on success (may be empty {})
  "errors": [ ... ]          // present only on 422 validation failures
}
```

---

## Endpoints

### 1. `POST /register`

Create a new user account. Sends a verification email automatically.

**Auth:** None

**Request Body:**

| Field      | Type   | Rules                                                        |
|------------|--------|--------------------------------------------------------------|
| `name`     | string | Required · 2–100 chars                                      |
| `email`    | string | Required · valid email · auto-lowercased                     |
| `password` | string | Required · 8–128 chars · must have uppercase + lowercase + digit |

```json
{
  "name": "Aditya Sharma",
  "email": "aditya@example.com",
  "password": "StrongPass1"
}
```

**Success Response:** `201 Created`

```json
{
  "success": true,
  "message": "Account created. Please check your email to verify your account.",
  "data": {}
}
```

**Error Responses:**

| Status | When |
|--------|------|
| 422    | Validation failed (missing/invalid fields) |
| 500    | Email already exists → `"An account with this email already exists"` |

---

### 2. `GET /verify-email?token=<raw_token>`

Verify user's email address using the token from the verification email link.

**Auth:** None

**Query Params:**

| Param   | Type   | Description                          |
|---------|--------|--------------------------------------|
| `token` | string | Raw verification token from the email link |

> **Frontend note:** The email links to `CLIENT_BASE_URL/verify-email?token=xxx`. Your frontend page should extract the `token` query param and call this API endpoint.

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Email verified successfully. You can now log in.",
  "data": {}
}
```

**Error Responses:**

| Status | When |
|--------|------|
| 400    | Missing token query param |
| 500    | Invalid/expired token → `"Invalid or expired verification link"` or `"Verification link has expired"` |

---

### 3. `POST /login`

Authenticate a user. Returns an access token in the response body and sets a refresh token as an HTTP-only cookie.

**Auth:** None

**Request Body:**

| Field      | Type   | Rules                   |
|------------|--------|-------------------------|
| `email`    | string | Required · valid email  |
| `password` | string | Required                |

```json
{
  "email": "aditya@example.com",
  "password": "StrongPass1"
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Logged in successfully",
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "user": {
      "id": "uuid-string",
      "name": "Aditya Sharma",
      "email": "aditya@example.com",
      "isEmailVerified": true
    }
  }
}
```

**Set-Cookie Header (automatic):**

```
refresh_token=<opaque_hex>; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000
```

> ⚠️ The `refreshToken` is **NOT** in the JSON body — it is only in the cookie. The frontend does **NOT** need to manually store it; the browser handles it automatically when `credentials: "include"` is set.

**Error Responses:**

| Status | When |
|--------|------|
| 422    | Validation failed |
| 500    | Wrong email/password → `"Invalid email or password"` |
| 500    | Email not verified → `"Please verify your email before logging in..."` |

---

### 4. `POST /refresh`

Silently refresh the access token using the refresh token cookie. Implements **token rotation** (old cookie replaced with new one).

**Auth:** None (uses cookie)

**Request Body:** None (empty body)

**Required Cookie:** `refresh_token` (set automatically by login)

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs..."
  }
}
```

A new `Set-Cookie` header replaces the old refresh token (rotation).

**Error Responses:**

| Status | When |
|--------|------|
| 401    | No cookie / invalid / expired / revoked token |

> **Frontend note:** Call this endpoint when the access token expires (HTTP 401 from a protected endpoint). If this also returns 401, redirect the user to login.

---

### 5. `POST /logout`

Log the user out. Revokes the refresh token and clears the cookie.

**Auth:** None (uses cookie)

**Request Body:** None

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": {}
}
```

> Always succeeds (even if no cookie was present).

---

### 6. `POST /forgot-password`

Request a password reset email. Always returns the same message regardless of whether the email exists (prevents enumeration).

**Auth:** None

**Request Body:**

| Field   | Type   | Rules                  |
|---------|--------|------------------------|
| `email` | string | Required · valid email |

```json
{
  "email": "aditya@example.com"
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "If an account with that email exists, a reset link has been sent.",
  "data": {}
}
```

> **Frontend note:** The email links to `CLIENT_BASE_URL/reset-password?token=xxx`. Your frontend page should provide a "new password" form and call `/reset-password` with the token + new password.

---

### 7. `POST /reset-password`

Reset the user's password using the token from the reset email.

**Auth:** None

**Request Body:**

| Field      | Type   | Rules                                                        |
|------------|--------|--------------------------------------------------------------|
| `token`    | string | Required · raw reset token from email                        |
| `password` | string | Required · 8–128 chars · uppercase + lowercase + digit       |

```json
{
  "token": "abc123hextoken...",
  "password": "NewSecurePass1"
}
```

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Password reset successfully. Please log in with your new password.",
  "data": {}
}
```

**Side effects:**
- All existing refresh tokens for the user are revoked (forces re-login on all devices)

**Error Responses:**

| Status | When |
|--------|------|
| 422    | Validation failed (weak password) |
| 500    | Invalid/expired token |

---

### 8. `GET /me` 🔒

Get the currently authenticated user's profile.

**Auth:** `Authorization: Bearer <accessToken>`

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "User fetched",
  "data": {
    "user": {
      "id": "uuid-string",
      "name": "Aditya Sharma",
      "email": "aditya@example.com",
      "phoneNo": null,
      "dob": null,
      "lastSeen": "2026-04-14T10:30:00.000Z",
      "isEmailVerified": true,
      "createdAt": "2026-04-14T09:00:00.000Z",
      "updatedAt": "2026-04-14T10:30:00.000Z"
    }
  }
}
```

**Error Responses:**

| Status | When |
|--------|------|
| 401    | Missing/invalid/expired Bearer token |
| 500    | User not found in DB |

---

### 9. `DELETE /delete-account` 🔒

Permanently delete the authenticated user's account and all associated data.

**Auth:** `Authorization: Bearer <accessToken>`

**Request Body:** None

**Success Response:** `200 OK`

```json
{
  "success": true,
  "message": "Account deleted successfully.",
  "data": {}
}
```

The refresh token cookie is also cleared.

**Error Responses:**

| Status | When |
|--------|------|
| 401    | Missing/invalid/expired Bearer token |

---

## Validation Error Format (422)

When request body validation fails, the response looks like:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email address" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

---

## Auth Error Format (401)

```json
{
  "success": false,
  "message": "Authentication required. Please log in."
}
```

Or for expired tokens:

```json
{
  "success": false,
  "message": "Session expired. Please log in again."
}
```

---

## Health Check

**`GET /health`** (mounted at root, not under `/api/auth`)

```json
{
  "success": true,
  "service": "user-svc",
  "status": "healthy",
  "timestamp": "2026-04-14T10:30:00.000Z"
}
```

---

## CORS Configuration

The server is configured with:

| Setting           | Value                                      |
|-------------------|--------------------------------------------|
| `origin`          | `CLIENT_BASE_URL` (default `http://localhost:3000`) |
| `credentials`     | `true`                                     |
| `methods`         | GET, POST, PUT, PATCH, DELETE, OPTIONS     |
| `allowedHeaders`  | Content-Type, Authorization                |

> **Frontend must set `credentials: "include"` (fetch) or `withCredentials: true` (axios) for cookies to work cross-origin.**

---

## Token Lifetimes

| Token                  | Lifetime | Storage                    |
|------------------------|----------|----------------------------|
| Access Token (JWT)     | 15 min   | Frontend memory / state    |
| Refresh Token          | 30 days  | HTTP-only cookie (auto)    |
| Email Verification     | 24 hours | Email link                 |
| Password Reset         | 1 hour   | Email link                 |
