# Digiability Community

A monorepo platform for accessible community management and communication. Built with **Turborepo**, **Next.js**, **Vite + React**, **React Native (Expo)**, **Express.js**, **Prisma**, and **PostgreSQL**.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Services & Ports](#-services--ports)
- [Development Workflows](#-development-workflows)
- [System Architecture](#-system-architecture)
- [Database](#-database)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 🎯 Project Overview

Digiability Community is a platform for people with disabilities, caregivers, therapists, and NGOs, featuring:

- **Mobile App** — the primary client, iOS/Android (React Native + Expo)
- **Web App** — browser client (Vite + React 19)
- **Admin Panel** — community management dashboard (Next.js 15)
- **Four backend services** — auth/users, chat, forum, and push notifications
- **Docker-containerized infrastructure** — PostgreSQL 16 & Redis 7

### Key Features

✅ **Authentication** — JWT RS256, email OTP verification, refresh-token rotation
✅ **Chat** — real-time DMs, Groups, and Care Circles over WebSocket
✅ **Forum** — Q&A with answers, votes, bookmarks, and Socket.io realtime
✅ **Mentors, Events, Profiles** — role-based community features
✅ **Push Notifications** — Expo Push via a Redis Stream pipeline
✅ **Admin Dashboard** — users, groups, forums, events, analytics, moderation
✅ **Accessibility & DPDP privacy** — a11y preferences, consent tracking, data export/deletion

---

## 🛠 Tech Stack

| **Layer** | **Technologies** |
|-----------|------------------|
| **Web** | Vite 8, React 19, TypeScript, React Router 6 |
| **Admin** | Next.js 15 (App Router), React, TailwindCSS |
| **Mobile** | React Native 0.81, Expo 54, React Navigation, Zustand |
| **Backend** | Node.js ≥18, Express.js, TypeScript (strict) |
| **Database** | PostgreSQL 16, Prisma ORM 5 |
| **Cache/Streams/Pub-Sub** | Redis 7 |
| **Tooling** | Turborepo, Docker Compose, npm workspaces |

---

## 📁 Project Structure

```
digiability-community/
├── apps/
│   ├── admin/            Next.js 15 App Router admin panel          :3001
│   ├── mobile/           Expo 54 + React Native 0.81 mobile app
│   └── web/              Vite 8 + React 19 web app                  :3000
│
├── packages/
│   ├── api/              API client wrappers (used by admin)
│   ├── moderation/       Shared moderation (keyword matcher)
│   ├── types/            Shared TypeScript types (minimal stub)
│   └── utils/            Shared utilities (minimal stub)
│
├── services/
│   ├── user-svc/         Auth, users, profiles, events, mentors     :4001
│   ├── chat-svc/         WebSocket, REST chat API, embedded workers :4002
│   ├── forum-svc/        Forum Q&A, Socket.io realtime              :4003
│   └── notif-svc/        Push notification worker (Redis consumer)  :4004
│
├── docker/postgres/init.sql   Runs once on first container boot
├── docs/                      Architecture, API, env, WebSocket docs
├── docker-compose.yml
├── turbo.json
└── package.json
```

Services do **not** import from each other's source — they communicate over HTTP and Redis only. For a detailed breakdown see [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md).

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0 (lockfile uses npm 11)
- **Docker** & **Docker Compose**

### 1. Clone & Install

```bash
git clone https://github.com/techonsy/digiability-community.git
cd digiability-community
npm install
```

### 2. Configure Environment Variables

Every app and service ships a `.env.example`. Copy each one and fill it in:

```bash
cp .env.example .env                              # Docker infra (Postgres/Redis)
cp services/user-svc/.env.example  services/user-svc/.env
cp services/chat-svc/.env.example  services/chat-svc/.env
cp services/forum-svc/.env.example services/forum-svc/.env
cp services/notif-svc/.env.example services/notif-svc/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/web/.env.example   apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Generate the RS256 key pair once — **user-svc holds the private key and is the only signer**; chat-svc and forum-svc get the *public key only*:

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
# Paste into the .env files using literal \n for line breaks
```

See [docs/env-guide.md](./docs/env-guide.md) for the complete variable reference.

### 3. Start Infrastructure & Services

```bash
# PostgreSQL 16 + Redis 7
docker compose up -d postgres redis

# Backend services (rebuilds the image if code changed)
docker compose up -d --build user-svc chat-svc forum-svc notif-svc

# Verify
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
curl http://localhost:4004/health

# Optional dev-only pgAdmin at http://localhost:5050
docker compose --profile dev up -d pgadmin
```

### 4. Initialize the Database

```bash
cd services/user-svc  && npx prisma migrate deploy && npx prisma generate
cd services/chat-svc  && npx prisma migrate deploy && npx prisma generate
cd services/forum-svc && npx prisma generate

# Seed the DigiBot system user (once, after first DB setup)
cd services/user-svc && npm run db:seed-bot
```

### 5. Run the Clients

```bash
cd apps/web    && npm run dev      # → http://localhost:3000
cd apps/admin  && npm run dev      # → http://localhost:3001
cd apps/mobile && npx expo start   # a = Android, i = iOS
```

`web`, `admin`, and `mobile` always run locally (or on Vercel/EAS) — they are never containerized.

> **Mobile on a physical device:** `localhost` won't resolve. Set the URLs in `apps/mobile/.env` to your machine's LAN IP (`ipconfig getifaddr en0` on macOS). See [apps/mobile/README.md](./apps/mobile/README.md).

---

## 🏢 Services & Ports

| Service | Port | Runtime | Responsibility |
|---|---|---|---|
| `user-svc` | 4001 | Docker | Auth (signs JWTs), users, profiles, mentors, events, privacy/consent |
| `chat-svc` | 4002 | Docker | WebSocket gateway, chat REST, embedded message + delivery workers |
| `forum-svc` | 4003 | Docker | Forum Q&A REST + Socket.io realtime |
| `notif-svc` | 4004 | Docker | Redis Stream consumer → Expo Push API |
| PostgreSQL | 5432 | Docker | Shared instance, separate schemas |
| Redis | 6379 | Docker | Streams, Pub/Sub, session registry |
| pgAdmin | 5050 | Docker (`--profile dev`) | DB UI |
| `web` | 3000 | Local / Vercel | Browser client |
| `admin` | 3001 | Local / Vercel | Admin panel |

### How services communicate

There is **no API gateway** — clients call each service directly.

- **user-svc** signs JWTs; it makes no runtime calls to other services (except an internal chat-svc call on account deletion).
- **chat-svc / forum-svc** verify JWTs with the shared public key; they never call user-svc.
- **forum-svc → notif-svc**: HTTP `POST /internal/notify`.
- **chat-svc → notif-svc**: via the Redis Stream `msg:notify`.
- **admin → user-svc / chat-svc**: a few Next.js API routes proxy with an `x-internal-secret` header; most query PostgreSQL directly.

---

## 💻 Development Workflows

```bash
# From the repo root — Turborepo runs across all workspaces
npm run build
npm run lint
npm run test

# Per-service dev servers (hot reload)
npm run user-svc:dev
npm run chat-svc:dev
npm run forum-svc:dev
npm run notif-svc:dev
npm run web:dev

# Docker infra
npm run docker:up
npm run docker:down
npm run docker:logs
```

Per-service TypeScript checks (no emit):

```bash
cd services/chat-svc && npx tsc --noEmit
cd apps/mobile       && npx tsc --noEmit
cd apps/web          && npm run lint    # web uses oxlint, not ESLint
```

### Logs

```bash
docker logs digiability_user_svc -f
docker logs digiability_chat_svc -f
docker logs digiability_postgres -f
```

---

## 🏗 System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Client Layer                        │
├─────────────────┬─────────────────┬──────────────────────┤
│  Mobile (Expo)  │  Web (Vite)     │  Admin (Next.js)     │
└────────┬────────┴────────┬────────┴──────────┬───────────┘
         │   direct calls — no API gateway     │
    ┌────┴──────────┬───────────────┬──────────┴─────┐
    │               │               │                │
 user-svc        chat-svc       forum-svc        notif-svc
  (4001)          (4002)         (4003)           (4004)
    │               │               │                │
    └───────────────┴───────┬───────┴────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │  PostgreSQL 16  │ Redis 7 │
              └───────────────────────────┘
```

### Message pipeline (chat)

```
Client WS → event-router → Redis Stream msg:created  → [ACK to sender]
msg-svc.worker    → persist via Prisma → Stream msg:persisted
delivery.worker   → online: Pub/Sub ws:deliver:{serverId}
                  → offline: Stream msg:notify
notif-svc         → device tokens → Expo Push API
```

Both workers start **automatically inside the chat-svc process** — no separate containers.

### Redis roles

1. **Streams** (durable pipeline): `msg:created`, `msg:persisted`, `msg:notify`, `forum:notify`, `msg:receipts`
2. **Pub/Sub** (ephemeral cross-server WS): `ws:deliver:{serverId}`, `ws:receipt:{serverId}`, `ws:typing:{serverId}`
3. **Session registry**: `ws:sessions:{userId}`, `ws:server:{serverId}`, `ws:presence:{userId}`

See [docs/architecture.md](./docs/architecture.md) for the JWT flow and security patterns.

---

## 🗄 Database

- **ORM**: Prisma 5 · **Database**: PostgreSQL 16 · **Migrations**: Prisma Migrate

All services share one PostgreSQL instance but use separate **schemas**:

| Service | Schema | Notes |
|---|---|---|
| `user-svc` | `public` | Signs/owns users, profiles, events, mentors, consents |
| `chat-svc` | `chat` | Fully isolated |
| `forum-svc` | `public` | **Shared with user-svc** — see the warning below |
| `notif-svc` | — | No Prisma; raw `pg` Pool reading `device_tokens` |

### ⚠️ Two things that will bite you

**1. `user-svc` and `forum-svc` share the `public` schema.** `prisma db push` does a full declarative reconciliation — any table it can see but doesn't declare gets **dropped**. Both `schema.prisma` files therefore declare inert **stub mirror models** of the other's tables. If you add or change a model in `public`, mirror the same change into the other service's stub block, or the next push will drop it. Outside local dev, prefer `prisma migrate deploy`.

**2. Migration history has drifted from `schema.prisma`.** Much of the schema was historically applied with `db push` and never captured as migrations, so a database built purely from `migrate deploy` came out incomplete (this broke chat writes, OTP, and consent in the live environment). Reconciliation migrations dated `20260711*` fix this; they are idempotent (`IF NOT EXISTS`, guarded `CREATE TYPE`) and safe to re-apply.

> Note: the older migrations are **not** clean from empty (`fix_auth_restore` re-creates the `Role` type). They cannot be edited — changing an applied migration breaks `migrate deploy` via a checksum mismatch. A database bootstrapped with `db push` must therefore be **baselined once** before deploys will reach the newer migrations:
> ```bash
> npx prisma migrate resolve --applied <each_old_migration_name>
> ```

### Common commands

```bash
# Apply migrations (production-safe — only runs explicit migration files)
cd services/user-svc && npx prisma migrate deploy

# Create a new migration during development
cd services/user-svc && npm run db:migrate -- --name add_new_field

# Sync schema without a migration file (LOCAL DEV ONLY — see warning above)
cd services/user-svc && npm run db:push

# Prisma Studio GUI
cd services/user-svc && npm run db:studio

# Regenerate the client after editing schema.prisma
cd services/user-svc && npm run db:generate
```

Each Prisma service generates its client to `src/generated/client/` (not `node_modules`). Import it as:

```typescript
import prisma from "./models/prisma.client";
```

---

## 📚 API Documentation

- [API Reference](./docs/api-reference.md) · [WebSocket Events](./docs/websocket-events.md)

All responses follow a consistent envelope:

```jsonc
{ "success": true,  "data": { } }                        // success
{ "success": false, "message": "...", "errors": [ ] }    // error (422 = validation)
```

### Example requests

```bash
# Register (returns tokens; login is blocked until the email OTP is verified)
curl -X POST http://localhost:4001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"Passw0rd123","role":"pwd"}'

# Verify the 6-digit OTP sent by email
curl -X POST http://localhost:4001/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","otp":"123456"}'

# Login
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"Passw0rd123"}'
```

The access token is returned in `data.accessToken`. The **refresh token is not in the JSON body** — it is delivered via the `x-refresh-token` response header and an HTTP-only cookie.

---

## 🚀 Deployment

See [docs/deployment.md](./docs/deployment.md).

| Target | Platform |
|---|---|
| Backend services | Docker → Kubernetes (GitOps via the `ngo-devops` repo) |
| `web` / `admin` | Vercel |
| `mobile` | App Store / Play Store via EAS — see [apps/mobile/README.md](./apps/mobile/README.md) |

**CI/CD** (`.github/workflows/ci.yml`): pushes to `main` that touch `services/**` build and push per-service images to GHCR, update the GitOps manifest, then run `prisma migrate deploy` inside the rolled-out `user-svc` / `chat-svc` pods.

Because the clients bake their API URLs in at **build time**, changing a backend URL requires rebuilding the web bundle and the mobile app — it is not a runtime setting.

---

## 📖 Additional Documentation

| Document | Purpose |
|----------|---------|
| [Project Structure](./PROJECT_STRUCTURE.md) | Detailed folder breakdown |
| [Architecture](./docs/architecture.md) | System design & auth flow |
| [API Reference](./docs/api-reference.md) | All endpoints & schemas |
| [Environment Guide](./docs/env-guide.md) | All required env variables |
| [WebSocket Events](./docs/websocket-events.md) | Real-time event schemas |
| [Deployment](./docs/deployment.md) | Production deployment |
| [Mobile / store builds](./apps/mobile/README.md) | Expo + EAS build and release |

---

## 🔒 Security

- ✅ JWT RS256 — only user-svc holds the private key; other services verify with the public key
- ✅ Refresh tokens stored as SHA-256 hashes and rotated on every use
- ✅ HTTP-only, SameSite=Strict refresh cookies (`Secure` when `NODE_ENV=production`)
- ✅ bcrypt password hashing; email OTP verification required before login
- ✅ Zod validation on all request bodies (422 with field-level errors)
- ✅ Rate limiting on register / login / OTP / password-reset
- ✅ Login lockout after repeated failures
- ✅ `x-internal-secret` on service-to-service internal routes

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Typecheck the workspaces you touched (`npx tsc --noEmit`)
4. Lint: `npm run lint`
5. If you changed a Prisma schema, add a migration **and** mirror any `public`-schema change into the other service's stub models
6. Commit with clear messages, push, and open a Pull Request

---

## 📄 License

This project is proprietary and confidential.

---

**Last Updated**: July 2026
**Maintained By**: Digiability Development Team
