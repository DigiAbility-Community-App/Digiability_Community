# user-svc — Authentication & User Management Service

A production-grade authentication microservice built with **Node.js, TypeScript, Express, Prisma (PostgreSQL), and JWT (RS256)**.

Implements a hybrid JWT + refresh token cookie pattern with email verification, password reset, and secure token rotation.

---

## Endpoints

| Feature | Method | Endpoint | Auth | Body/Params |
|---|---|---|---|---|
| Register | POST | `/api/auth/register` | ❌ | `{ name, email, password }` |
| Verify Email | GET | `/api/auth/verify-email?token=` | ❌ | Query param |
| Login | POST | `/api/auth/login` | ❌ | `{ email, password }` |
| Refresh Token | POST | `/api/auth/refresh` | ❌ (cookie) | — |
| Logout | POST | `/api/auth/logout` | ❌ (cookie) | — |
| Forgot Password | POST | `/api/auth/forgot-password` | ❌ | `{ email }` |
| Reset Password | POST | `/api/auth/reset-password` | ❌ | `{ token, password }` |
| Get Current User | GET | `/api/auth/me` | ✅ Bearer | — |
| Delete Account | DELETE | `/api/auth/delete-account` | ✅ Bearer | — |

> 📖 Full request/response details: see [`docs/api-reference.md`](../../docs/api-reference.md)

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
docker-compose up -d postgres

# 5. Run migrations
npm run db:migrate

# 6. Start dev server
npm run dev
# → http://localhost:4001
```

Use `localhost` in `services/user-svc/.env` when the service runs on your machine.
If you run `user-svc` with Docker Compose instead, the compose file overrides `DATABASE_URL` to use the Postgres service host `postgres`.

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
- ✅ JWT RS256 (asymmetric — private key signs, public key verifies)
- ✅ SHA-256 hashed refresh tokens in DB (raw token only in cookie)
- ✅ HTTP-only + SameSite=Strict + Secure cookies
- ✅ Refresh token rotation (old deleted on each use)
- ✅ Email enumeration prevention on forgot-password
- ✅ Token expiry enforcement on all token types
- ✅ Cascade delete (all tokens removed when account deleted)
- ✅ Zod validation on all user-input endpoints
- ✅ 10KB JSON body size limit

---

## Related Docs

| Doc | Path |
|-----|------|
| API Reference (full) | [`docs/api-reference.md`](../../docs/api-reference.md) |
| Auth Architecture | [`docs/architecture.md`](../../docs/architecture.md) |
| Env Setup Guide | [`docs/env-guide.md`](../../docs/env-guide.md) |
# CI test
