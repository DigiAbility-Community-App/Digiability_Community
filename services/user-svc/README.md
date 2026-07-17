# user-svc — Authentication & User Management Service

A production-grade authentication microservice built with **Node.js, TypeScript, Express, Prisma (PostgreSQL), and JWT (RS256)**.

Implements a hybrid JWT + refresh token cookie pattern with email verification, password reset, and secure token rotation.

---

## Endpoints

### Auth — `/api/auth`

| Feature | Method | Endpoint | Auth | Body/Params |
|---|---|---|---|---|
| Register | POST | `/register` | ❌ | `{ name, email, password, role? }` |
| Verify Email (OTP) | POST | `/verify-email` | ❌ | `{ email, otp }` |
| Resend OTP | POST | `/resend-otp` | ❌ | `{ email }` |
| Login | POST | `/login` | ❌ | `{ email, password }` |
| Refresh Token | POST | `/refresh` | ❌ (cookie or Bearer) | — |
| Logout | POST | `/logout` | ❌ (cookie) | — |
| Forgot Password | POST | `/forgot-password` | ❌ | `{ email }` |
| Reset Password | POST | `/reset-password` | ❌ | `{ token, password }` |
| Get Current User | GET | `/me` | ✅ Bearer | — |
| Update Role | PATCH | `/role` | ✅ Bearer | `{ role }` or `{ roles }` |
| Batch Lookup | POST | `/users/batch` | ✅ Bearer | `{ ids }` |
| Search Users | GET | `/users/search?q=` | ✅ Bearer | — |
| Delete Account | DELETE | `/delete-account` | ✅ Bearer | — |
| Register Push Token | POST | `/device-token` | ✅ Bearer | `{ token, platform }` |
| Remove Push Token | DELETE | `/device-token` | ✅ Bearer | — |

### Privacy / DPDP — `/api/auth/privacy`

| Feature | Method | Endpoint | Auth |
|---|---|---|---|
| List consents | GET | `/consent` | ✅ Bearer |
| Update consent | POST | `/consent` | ✅ Bearer |
| Withdraw consent | DELETE | `/consent/:type` | ✅ Bearer |
| Export my data | GET | `/export` | ✅ Bearer |

### Other areas

| Area | Base path | Notable routes |
|---|---|---|
| Profiles | `/api/users/profiles` | `/me`, `/details`, `/check-username`, per-role sub-profiles (`pwd`, `caregiver`, `therapist`, `ngo`) |
| Mentors | `/api/users/mentors` | `GET /match`, `GET /profile/me`, `GET /:userId`, `POST /profile`, `POST /:id/reviews` |
| Events | `/api/events` | `GET /`, `GET /:id` |
| Reports | `/api/reports` | `POST /` |
| Master data | `/api/master` | `GET /disability-types` |
| Moderation (internal/admin) | `/api/moderation` | flags, keywords, review queue, audit |

> 📖 Full request/response details: see [`docs/api-reference.md`](../../docs/api-reference.md)

### Auth notes

- **Login is blocked until the email is verified** (403). Registration returns tokens but the account is unusable until the OTP is confirmed.
- OTP: 6 digits via `crypto.randomInt`, 10-minute expiry, max 5 attempts (deleted on lockout), 60-second resend cooldown.
- The **refresh token is not in the JSON response body** — it is delivered via the `x-refresh-token` response header and an HTTP-only cookie. `/refresh` reads the cookie first and falls back to `Authorization: Bearer <refreshToken>` for native clients.
- Password reset revokes **all** refresh tokens, forcing re-login on every device.

---

## Quick Start

```bash
# 1. Install (from monorepo root)
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, JWT keys, SMTP credentials

# 3. Generate RSA keys (for JWT RS256)
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
# Paste contents into .env (use \n for newlines)

# 4. Start Postgres (from monorepo root)
docker compose up -d postgres

# 5. Apply migrations + generate the client
npx prisma migrate deploy
npm run db:generate

# 6. Seed the DigiBot system user (once, after first DB setup)
npm run db:seed-bot

# 7. Start dev server
npm run dev
# → http://localhost:4001
```

Use `localhost` in `services/user-svc/.env` when the service runs on your machine.
If you run `user-svc` with Docker Compose instead, the compose file overrides `DATABASE_URL` to use the Postgres service host `postgres`.

---

## Database

user-svc owns the **`public`** schema: `users`, `user_profiles`, per-role profiles, `refresh_tokens`, `email_verification_tokens`, `password_reset_tokens`, `device_tokens`, `events`, `mentor_profiles`, `mentor_reviews`, `user_consents`, `user_reports`, `disability_types`, and the moderation/admin tables.

### ⚠️ `public` is shared with forum-svc

`prisma db push` fully reconciles everything it can see in the target schema — so a push from **either** service will **drop the other's tables** unless both `schema.prisma` files keep their inert **stub mirror models** in sync. This file declares stubs for forum-svc's `forum_*` tables purely so a push doesn't delete them.

**If you add or change a model in `public`, mirror the identical change into forum-svc's stub block.** Outside local dev, prefer `prisma migrate deploy` (applies only explicit migration files) over `db push` (full destructive diff).

### ⚠️ Migration history drift

Much of this schema was historically applied with `db push` and never captured as migrations, so a database built purely from `migrate deploy` came out incomplete — this broke registration/OTP and DPDP consent in the live environment. The `20260711*` reconciliation migrations fix that; they are idempotent (`IF NOT EXISTS`, guarded `CREATE TYPE`) and safe to re-apply.

The older migrations are **not** clean from empty (`fix_auth_restore` re-creates the `Role` type) and cannot be edited — changing an applied migration breaks `migrate deploy` via a checksum mismatch. A database bootstrapped with `db push` must be **baselined once** before deploys reach the newer migrations:

```bash
npx prisma migrate resolve --applied <each_old_migration_name>
```

---

## Architecture

```
src/
├── index.ts                  ← Express app + server startup
├── controllers/
│   └── auth.controller.ts    ← HTTP layer (parse → service → response)
├── services/
│   ├── auth.service.ts       ← Business logic (register, login, etc.)
│   ├── token.service.ts      ← Token CRUD + rotation + revocation
│   └── email.service.ts      ← Nodemailer, HTML email templates
├── middleware/
│   ├── auth.middleware.ts     ← JWT Bearer verification
│   ├── validate.middleware.ts ← Zod request body validation
│   └── error.middleware.ts    ← Global error handler + async wrapper
├── routes/
│   └── auth.routes.ts        ← Route + middleware chain definitions
├── models/
│   └── prisma.client.ts      ← Prisma client singleton
└── utils/
    ├── jwt.util.ts           ← RS256 sign/verify
    ├── hash.util.ts          ← bcrypt (passwords) + SHA-256 (tokens)
    ├── cookie.util.ts        ← Refresh token cookie helpers
    └── validation.util.ts    ← Zod schemas + TypeScript types
```

---

## Security

- ✅ bcrypt password hashing (12 rounds)
- ✅ JWT RS256 (asymmetric — **this is the only service holding the private key**; chat-svc and forum-svc verify with the public key only)
- ✅ SHA-256 hashed refresh tokens in DB (raw token never persisted)
- ✅ HTTP-only + SameSite=Strict cookies (`Secure` when `NODE_ENV=production`)
- ✅ Refresh token rotation (old deleted on each use)
- ✅ Email OTP verification required before login
- ✅ Rate limiting on register / login / OTP / password-reset
- ✅ Login lockout after repeated failed attempts
- ✅ Email enumeration prevention on forgot-password
- ✅ Token expiry enforcement on all token types
- ✅ Cascade delete (all tokens removed when account deleted)
- ✅ Zod validation on all user-input endpoints (422 + field errors)
- ✅ 10KB JSON body size limit

> Over plain `http://`, `Secure` cookies are dropped by browsers — so with `NODE_ENV=production` and no TLS the web refresh flow silently fails. Native mobile is unaffected (it uses the `x-refresh-token` header + `expo-secure-store`).

---

## Related Docs

| Doc | Path |
|-----|------|
| API Reference (full) | [`docs/api-reference.md`](../../docs/api-reference.md) |
| Auth Architecture | [`docs/architecture.md`](../../docs/architecture.md) |
| Env Setup Guide | [`docs/env-guide.md`](../../docs/env-guide.md) |
| Monorepo overview | [`README.md`](../../README.md) |

