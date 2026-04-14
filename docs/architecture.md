# Digiability Community — Auth Architecture

## Overview

The `user-svc` implements a **hybrid JWT + Refresh Token authentication** pattern — a production-standard approach that balances security and user experience.

> **TL;DR for your AI:**  
> Access tokens (short-lived JWTs in memory) handle authorization.  
> Refresh tokens (long-lived opaque strings in HTTP-only cookies) handle session persistence.  
> The frontend never touches refresh tokens directly — the browser cookie jar handles it.

---

## High-Level Auth Flow

```
┌─────────────┐                                  ┌──────────────┐
│   Frontend   │                                  │   user-svc   │
│  (React/Next)│                                  │  (Express)   │
└──────┬───────┘                                  └──────┬───────┘
       │                                                 │
       │  POST /api/auth/register                        │
       │  { name, email, password }                      │
       ├────────────────────────────────────────────────►│
       │                                                 │──► Hash password (bcrypt)
       │                                                 │──► Save user to PostgreSQL
       │                                                 │──► Generate verification token
       │                                                 │──► Send email (Nodemailer)
       │◄────────────────────────────────────────────────┤
       │  201 { message: "Check your email" }            │
       │                                                 │
       │  ── User clicks email link ──                   │
       │                                                 │
       │  GET /api/auth/verify-email?token=xxx           │
       ├────────────────────────────────────────────────►│
       │                                                 │──► Validate token (SHA-256 lookup)
       │                                                 │──► Mark user.isEmailVerified = true
       │◄────────────────────────────────────────────────┤
       │  200 { message: "Email verified" }              │
       │                                                 │
       │  POST /api/auth/login                           │
       │  { email, password }                            │
       ├────────────────────────────────────────────────►│
       │                                                 │──► Verify password (bcrypt)
       │                                                 │──► Check isEmailVerified
       │                                                 │──► Sign JWT access token (RS256)
       │                                                 │──► Create refresh token in DB
       │◄────────────────────────────────────────────────┤
       │  200 { accessToken, user }                      │
       │  Set-Cookie: refresh_token=<opaque>; HttpOnly   │
       │                                                 │
       │  ══════ User is now authenticated ══════        │
       │                                                 │
       │  GET /api/auth/me                               │
       │  Authorization: Bearer <accessToken>            │
       ├────────────────────────────────────────────────►│
       │                                                 │──► Verify JWT (RS256 public key)
       │                                                 │──► Attach req.user = { sub, email }
       │◄────────────────────────────────────────────────┤
       │  200 { user: { id, name, email, ... } }         │
       │                                                 │
       │  ── Access token expires (15 min) ──            │
       │                                                 │
       │  POST /api/auth/refresh                         │
       │  Cookie: refresh_token=<old_token>              │
       ├────────────────────────────────────────────────►│
       │                                                 │──► Validate old refresh token
       │                                                 │──► Delete old, create new (rotation)
       │                                                 │──► Sign fresh access token
       │◄────────────────────────────────────────────────┤
       │  200 { accessToken }                            │
       │  Set-Cookie: refresh_token=<new_token>          │
       │                                                 │
       │  POST /api/auth/logout                         │
       │  Cookie: refresh_token=<token>                  │
       ├────────────────────────────────────────────────►│
       │                                                 │──► Revoke refresh token in DB
       │◄────────────────────────────────────────────────┤
       │  200 { message: "Logged out" }                  │
       │  Set-Cookie: refresh_token=; Max-Age=0          │
       │                                                 │
```

---

## Why This is a "Hybrid" Auth Flow

| Concern              | Mechanism                              | Why                                                    |
|----------------------|----------------------------------------|--------------------------------------------------------|
| **Authorization**    | JWT access token (RS256, 15m TTL)      | Stateless verification — no DB lookup per request      |
| **Session persistence** | Opaque refresh token (30-day cookie) | Long-lived session without long-lived JWTs             |
| **XSS protection**   | HTTP-only cookie for refresh token     | JavaScript can never read the refresh token            |
| **CSRF protection**  | SameSite=Strict cookie                 | Cookie not sent on cross-origin requests               |
| **Token theft mitigation** | Refresh token rotation            | If stolen, first use by either party invalidates it    |
| **Asymmetric signing** | RS256 (private/public key pair)      | Other microservices can verify JWTs with only the public key |

---

## Token Storage Strategy (Frontend)

```
┌────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│                                                    │
│  ┌───────────────────────┐                         │
│  │   In-Memory State     │  ← accessToken          │
│  │   (React state/       │     (15 min TTL)         │
│  │    Context/Zustand)   │                         │
│  └───────────────────────┘                         │
│                                                    │
│  ┌───────────────────────┐                         │
│  │   Browser Cookie Jar  │  ← refresh_token        │
│  │   (HttpOnly — JS      │     (30 day TTL)         │
│  │    cannot read this)  │     (auto-sent with      │
│  └───────────────────────┘      credentials:include)│
│                                                    │
│  ❌ Do NOT store tokens in localStorage             │
│  ❌ Do NOT store tokens in sessionStorage           │
│  ❌ Do NOT manually handle refresh token cookies    │
└────────────────────────────────────────────────────┘
```

---

## Frontend Integration Checklist

### 1. HTTP Client Setup (Axios example)

```typescript
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:4001/api",
  withCredentials: true,  // ← CRITICAL: sends cookies cross-origin
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = getAccessToken(); // from your state/store
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await api.post("/auth/refresh");
        setAccessToken(data.data.accessToken); // save to state
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original); // retry failed request
      } catch {
        // Refresh also failed → session is dead
        clearAccessToken();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
```

### 2. Pages the Frontend Needs

| Route                  | Purpose                                           |
|------------------------|---------------------------------------------------|
| `/register`            | Registration form → `POST /api/auth/register`     |
| `/login`               | Login form → `POST /api/auth/login`               |
| `/verify-email`        | Reads `?token=` → calls `GET /api/auth/verify-email?token=` |
| `/forgot-password`     | Email input → `POST /api/auth/forgot-password`     |
| `/reset-password`      | Reads `?token=`, shows new password form → `POST /api/auth/reset-password` |

### 3. Silent Refresh on App Load

When the app loads (page refresh/new tab), the access token in memory is gone. Call `POST /api/auth/refresh` on mount to silently restore the session:

```typescript
useEffect(() => {
  api.post("/auth/refresh")
    .then(({ data }) => setAccessToken(data.data.accessToken))
    .catch(() => { /* not logged in — that's fine */ });
}, []);
```

---

## Service Architecture

```
services/user-svc/
├── src/
│   ├── index.ts                  ← Express app entry point
│   ├── controllers/
│   │   └── auth.controller.ts    ← HTTP layer (parse req → call service → format res)
│   ├── services/
│   │   ├── auth.service.ts       ← Core business logic (register, login, etc.)
│   │   ├── token.service.ts      ← Token create/validate/rotate/revoke
│   │   └── email.service.ts      ← Nodemailer + HTML email templates
│   ├── middleware/
│   │   ├── auth.middleware.ts     ← JWT verification (Bearer token)
│   │   ├── validate.middleware.ts ← Zod schema request body validation
│   │   └── error.middleware.ts    ← Global error handler + async wrapper
│   ├── routes/
│   │   └── auth.routes.ts        ← Route definitions + middleware chains
│   ├── models/
│   │   └── prisma.client.ts      ← Prisma client singleton
│   └── utils/
│       ├── jwt.util.ts           ← RS256 sign/verify with private/public keys
│       ├── hash.util.ts          ← bcrypt (passwords) + SHA-256 (tokens)
│       ├── cookie.util.ts        ← Set/clear/read refresh token cookie
│       └── validation.util.ts    ← Zod schemas + inferred TypeScript types
├── prisma/
│   └── schema.prisma             ← Database schema (User + 3 token tables)
└── .env.example                  ← Environment variable template
```

---

## Database Schema (PostgreSQL)

```
┌──────────────────────────┐
│          users           │
├──────────────────────────┤
│ id           UUID (PK)   │
│ name         String      │
│ email        String (UQ) │
│ password     String      │  ← bcrypt hash
│ phoneNo      String?     │
│ dob          DateTime?   │
│ lastSeen     DateTime?   │
│ isEmailVerified Boolean  │
│ createdAt    DateTime    │
│ updatedAt    DateTime    │
└────────┬─────────────────┘
         │ onDelete: Cascade
         ├─────────────────────────────┐─────────────────────────────┐
         ▼                             ▼                             ▼
┌────────────────────┐  ┌─────────────────────────┐  ┌──────────────────────┐
│  refresh_tokens    │  │ email_verification_     │  │ password_reset_      │
│                    │  │ tokens                  │  │ tokens               │
├────────────────────┤  ├─────────────────────────┤  ├──────────────────────┤
│ id       UUID (PK) │  │ id       UUID (PK)      │  │ id       UUID (PK)   │
│ userId   UUID (FK) │  │ userId   UUID (FK)       │  │ userId   UUID (FK)   │
│ tokenHash String   │  │ token    String (hash)   │  │ token    String      │
│ expiresAt DateTime │  │ expiresAt DateTime       │  │ expiresAt DateTime   │
│ revoked  Boolean   │  │ createdAt DateTime       │  │ createdAt DateTime   │
│ createdAt DateTime │  └─────────────────────────┘  └──────────────────────┘
└────────────────────┘
```

All token tables cascade-delete when the parent `User` is deleted.

---

## Security Model Summary

| Layer                | Implementation                                            |
|----------------------|-----------------------------------------------------------|
| Password hashing     | bcrypt (12 salt rounds)                                   |
| JWT signing          | RS256 (asymmetric — private key signs, public key verifies) |
| Token storage in DB  | SHA-256 hashed (raw token never stored)                   |
| Refresh token delivery | HTTP-only + SameSite=Strict + Secure cookie              |
| Refresh token rotation | Old token deleted, new one issued on each `/refresh`     |
| Email enumeration    | `/forgot-password` always returns same message            |
| Token expiry         | Strict enforcement on all token types                     |
| Cascade cleanup      | Deleting a user removes all associated tokens             |
| Request validation   | Zod schema validation on all input-accepting endpoints    |
| Payload size limit   | 10KB JSON body limit                                      |
