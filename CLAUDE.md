# CLAUDE.md — Digiability Community

Developer reference for working in this repository. Accurate to the code as of June 2026.

---

## Workspace layout

npm workspaces + Turborepo (`turbo.json`). Node ≥ 18, npm ≥ 9 (lockfile uses npm 11).

```
digiability-community/
├── apps/
│   ├── admin/          Next.js 15 App Router admin panel            :3001
│   ├── mobile/         Expo 54 + React Native 0.81 mobile app
│   └── web/            Vite 8 + React 19 web app                    :3000
├── packages/
│   ├── api/            API client wrappers (consumed by admin panel)
│   ├── types/          Shared TypeScript types (stub — minimal content)
│   └── utils/          Shared utilities (stub — minimal content)
├── services/
│   ├── user-svc/       Auth, users, profiles, events, mentors       :4001
│   ├── chat-svc/       WebSocket, REST chat API, embedded workers   :4002
│   ├── forum-svc/      Forum Q&A, Socket.io realtime                :4003
│   └── notif-svc/      Push notification worker (Redis consumer)    :4004
├── docker/
│   └── postgres/init.sql   Runs once on first container boot
├── docker-compose.yml
├── turbo.json
└── package.json
```

**Removed stubs**: `services/group-svc` (empty placeholder — Group/Care Circle logic lives entirely in `chat-svc`) and `services/app` (an abandoned parallel implementation, superseded by the user-svc/chat-svc/notif-svc split) were deleted — neither was wired into `docker-compose.yml`, referenced by any script, or imported anywhere. `packages/types` and `packages/utils` remain minimal stubs. Services do **not** import from each other's source — they communicate over HTTP and Redis only.

**All four backend services now have Dockerfiles and are in `docker-compose.yml`**, including `forum-svc` (added — previously undeployable). `apps/admin` and `apps/web` are deployed to Vercel, not containerized.

---

## Running locally

### Infrastructure (Docker — always start first)

```bash
# Start PostgreSQL 16 + Redis 7
docker compose up -d postgres redis

# Start dockerized services (rebuilds image if code changed)
docker compose up -d --build user-svc chat-svc notif-svc

# Verify healthy
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4004/health

# Rebuild a single service after code changes
docker compose up -d --build chat-svc

# Dev-only: pgAdmin UI at http://localhost:5050
docker compose --profile dev up -d pgadmin
```

### Local-only services (separate terminals)

`forum-svc` now has a Dockerfile and runs via `docker compose up -d --build forum-svc` too — use the commands below only when you want hot-reload during development instead.

```bash
cd services/forum-svc && npm run dev   # port 4003
cd apps/web           && npm run dev   # port 3000
cd apps/admin         && npm run dev   # port 3001
cd apps/mobile        && npx expo start
```

`web`, `admin`, and `mobile` always run locally (or on Vercel/EAS) — never containerized. `forum-svc` runs locally here purely for hot-reload convenience.

### Logs

```bash
docker logs digiability_chat_svc -f
docker logs digiability_user_svc -f
docker logs digiability_postgres -f
```

---

## Build, lint, TypeScript

Turborepo orchestrates all workspaces. Most services do not yet have test suites.

```bash
# From repo root — runs turbo across all workspaces:
npm run build
npm run lint

# Per-service TypeScript checks (no emit):
cd services/chat-svc && npx tsc --noEmit
cd services/user-svc && npx tsc --noEmit
cd apps/web          && npx tsc --noEmit
cd apps/mobile       && npx tsc --noEmit

# web uses oxlint (not ESLint):
cd apps/web && npm run lint
```

Individual service scripts (run from `services/<name>/`):

| Script | What it does |
|---|---|
| `npm run dev` | ts-node-dev hot-reload |
| `npm run build` | tsc → dist/ |
| `npm run start` | node dist/index.js (production) |
| `npm run db:generate` | prisma generate |
| `npm run db:migrate` | prisma migrate dev (creates migration files) |
| `npm run db:push` | prisma db push (sync schema without migration files — dev only) |
| `npm run db:studio` | open Prisma Studio |

---

## Databases and Prisma

All services share a single PostgreSQL 16 instance (`digiability_db`) but use separate **schemas** (PostgreSQL namespaces):

| Service | PostgreSQL schema | Key models |
|---|---|---|
| `user-svc` | `public` | User, UserProfile, MentorProfile, RefreshToken, EmailVerificationToken, PasswordResetToken, DeviceToken, Event, MentorReview |
| `chat-svc` | `chat` | Conversation, ConversationMember, Message, MessageRecipient, MessageReceipt, GroupInvite, OutboxEvent, HiddenMessage |
| `forum-svc` | `public` (shares with user-svc — see note below) | ForumQuestion, ForumAnswer, ForumVote, ForumTag, ForumReport, ForumUserStats, Bookmark, Notification, plus **stub mirrors** of user-svc's User/MentorProfile/etc. models |
| `notif-svc` | — | No Prisma — uses raw `pg` Pool, reads `device_tokens` directly from `public` schema |

**⚠️ `user-svc` and `forum-svc` share the `public` schema, and each one's `prisma db push` will silently DROP the other's tables/columns if their schemas don't fully agree.** `prisma db push` does a full declarative reconciliation of everything it can see in the target schema — any table or column present in the DB but absent from the Prisma file being pushed gets deleted, no warning beyond a data-loss prompt that's easy to `--accept-data-loss` past on autopilot. Both services' `schema.prisma` therefore declare **inert stub models** mirroring the other's tables (`MentorProfile`, `Event`, `DeviceToken`, `UserReport`, `AdminAuditLog` in forum-svc's file; `ForumQuestion`, `ForumAnswer`, etc. in user-svc's file) purely so each push sees the full picture and doesn't touch what it doesn't own. **If you add or change a model in either service that lives in `public`, mirror the exact same change into the other service's stub block, or the next `db push` on either side will drop it.** For production, prefer `prisma migrate deploy` (tracks history, only applies explicit migrations) over `db push` (full destructive diff) for exactly this reason.

Each service with Prisma has its own `prisma/schema.prisma` and generates its client to `src/generated/client/` (not `node_modules`). Import as:
```typescript
import prisma from "./models/prisma.client";
```

### Schema management

```bash
# Dev schema sync (no migration files):
cd services/user-svc  && npx prisma db push
cd services/chat-svc  && npx prisma db push
cd services/forum-svc && npx prisma db push

# Regenerate client after schema edits:
cd services/user-svc  && npx prisma generate
cd services/chat-svc  && npx prisma generate

# Seed the DigiBot system user (once after first DB setup):
cd services/user-svc && npm run db:seed-bot
```

---

## Service ports and communication

| Service | Port | Runtime |
|---|---|---|
| `user-svc` | 4001 | Docker |
| `chat-svc` | 4002 | Docker |
| `forum-svc` | 4003 | Docker (or local for hot-reload) |
| `notif-svc` | 4004 | Docker |
| PostgreSQL | 5432 | Docker |
| Redis | 6379 | Docker |
| pgAdmin | 5050 | Docker (`--profile dev`) |
| `web` | 3000 | Local dev / Vercel in production |
| `admin` | 3001 | Local dev / Vercel in production |

### How services communicate

There is no API gateway. Clients call services directly.

- **user-svc → (nobody)**: Signs JWTs. Does not call other services at runtime.
- **chat-svc → user-svc**: None at runtime. JWT public key is shared at deploy time; chat-svc never makes HTTP calls to user-svc.
- **forum-svc → notif-svc**: HTTP `POST /internal/notify` for push notifications on forum activity.
- **chat-svc → notif-svc**: Via Redis Stream `msg:notify` (not HTTP). delivery.worker publishes; notif-svc consumes.
- **admin → user-svc/chat-svc**: Next.js API routes proxy HTTP requests.

### Redis usage (three distinct roles)

**1. Redis Streams — durable message pipeline:**

| Stream | Producer | Consumer |
|---|---|---|
| `msg:created` | WS message handler | msg-svc.worker |
| `msg:persisted` | msg-svc.worker | delivery.worker |
| `msg:notify` | delivery.worker | notif-svc |
| `forum:notify` | forum-svc | notif-svc |
| `msg:receipts` | delivery.worker | receipt-processor |

**2. Redis Pub/Sub — ephemeral cross-server WS delivery:**
- `ws:deliver:{serverId}` — route message to connections on target server
- `ws:receipt:{serverId}` — broadcast receipts
- `ws:typing:{serverId}` — broadcast typing indicators

**3. Session Registry — WebSocket session tracking:**
- `ws:sessions:{userId}` — Hash of connId → SessionInfo (TTL: 120s, refreshed on heartbeat)
- `ws:server:{serverId}` — Set of connIds owned by this server
- `ws:presence:{userId}` — `"online"` | ISO timestamp of last seen (24h TTL when offline)

---

## Message pipeline (critical path)

```
Client WS → event-router.ts
  → handleMessageSend() → publishMessageCreated() → Redis Stream msg:created
  → [ACK sent to sender immediately]

msg-svc.worker.ts (embedded in chat-svc process)
  → XREADGROUP msg:created → persistMessage() via Prisma → PostgreSQL
  → publishMessagePersisted() → Redis Stream msg:persisted

delivery.worker.ts (embedded in chat-svc process)
  → XREADGROUP msg:persisted → lookup sessions in Redis hash
  → online: Pub/Sub publish to ws:deliver:{serverId}
  → offline: publishMessageNotify() → Redis Stream msg:notify

delivery.service.ts (Pub/Sub subscriber in chat-svc)
  → receives ws:deliver:{serverId} → connectionManager.sendToUser()
  → client receives message.new WS event

notif-svc
  → XREADGROUP msg:notify → getDeviceTokens() (Postgres) → Expo Push API
```

Both workers start **automatically** inside chat-svc on boot (see `src/index.ts`). No separate containers needed.

---

## Authentication flow

### JWT (RS256 asymmetric)

- **user-svc only** holds the private key (`JWT_PRIVATE_KEY`) and signs access tokens.
- **chat-svc and forum-svc** hold the public key only (`JWT_PUBLIC_KEY`) — they verify but never sign.
- Access token lifetime: `15m` (env `JWT_EXPIRES_IN`)
- Refresh token lifetime: `30 days` (env `REFRESH_TOKEN_EXPIRES_DAYS`)
- All tokens stored in DB as SHA-256 hashes (raw tokens are never persisted)

### Token delivery

- **Web**: access token in Zustand (in-memory); refresh token in `localStorage` (key: `digiability_refresh_token`). Also set as HTTP-only `sameSite=strict` cookie. Token read from `x-refresh-token` response header or cookie.
- **Mobile**: access token in Zustand; refresh token in `expo-secure-store` (key: `digiability_refresh_token`).
- **Refresh endpoint**: `POST /api/auth/refresh`. Reads token from cookie first; falls back to `Authorization: Bearer <token>` header (native clients can't reliably read cookies).

### Silent refresh (web)

`apps/web/src/services/apiClient.ts` — Axios response interceptor catches 401, calls `/api/auth/refresh`, queues concurrent requests during refresh, retries them all on success. On refresh failure, clears auth state and `localStorage`.

### Email verification (OTP)

- 6-digit OTP via `crypto.randomInt` (cryptographically random)
- Expires: 10 minutes
- Max attempts: 5 (OTP deleted on lockout — must request new one)
- Resend rate limit: 60-second cooldown
- Login is blocked until email is verified

### Password reset

- Token: 64-byte random, stored as SHA-256 hash, expires in 1 hour
- On success: revokes all refresh tokens for the user (forces re-login on all devices)

### `auth.middleware.ts`

Reads `Authorization: Bearer <token>` header. Sets `req.user = { sub, email, iat, exp }`. Returns 401 on invalid or expired token (never 403 for token errors).

---

## Coding conventions

### Service structure

**user-svc and forum-svc** (3-layer):
```
src/
├── index.ts / server.ts     Express app + startup
├── routes/                  Thin — just maps paths to middleware + handler
├── controllers/             Handle req/res, call service, send response
├── services/                Business logic — orchestrates DB and external calls
├── middleware/              auth, error, validate
├── models/prisma.client.ts  Prisma singleton
├── utils/                   jwt, hash, cookie, validation
└── generated/client/        Prisma output — do not edit
```

**chat-svc** (4-layer + workers):
```
src/
├── index.ts
├── routes/, controllers/, services/
├── repositories/            Only layer that calls Prisma directly
├── websocket/               gateway.ts, event-router.ts, handlers/, connection-manager.ts
├── workers/                 msg-svc.worker.ts, delivery.worker.ts
├── streams/                 producer.ts, constants.ts
├── config/                  env.ts, redis.ts, logger.ts
├── types/                   ws-events.ts, message.types.ts, common.types.ts
└── utils/
```

chat-svc adds a repository layer between service and Prisma. user-svc calls Prisma directly from the service layer.

### Validation

All request bodies are validated with **Zod** before controllers run. The `validate(ZodSchema)` middleware (`src/middleware/validate.middleware.ts`) returns 422 with field-level errors on failure and replaces `req.body` with the parsed+coerced data.

```typescript
router.post("/register", validate(RegisterSchema), register);
```

### Error handling

`createError(message, statusCode)` creates an `AppError` with `isOperational: true`. These are safe to surface to clients. Unexpected throws produce a generic 500 in production. `asyncHandler(fn)` wraps async controllers to forward thrown errors to `next()`.

```typescript
// Throw:
throw createError("Invalid email or password", 400);

// Client receives:
{ "success": false, "message": "Invalid email or password" }
```

All success responses: `{ "success": true, "data": { ... } }`
All error responses: `{ "success": false, "message": "...", "errors": [...] }`

### File naming

- `kebab-case.ts` for files (`auth.service.ts`, `event-router.ts`)
- Services: named exports from plain functions or class instances
- Prisma tables: `snake_case` via `@@map`
- TypeScript types: `PascalCase`

### TypeScript

All services use `strict: true`. Backend targets `ES2020 / commonjs`. Web targets `esnext / module`. Avoid `any` — use `unknown` and narrow with type guards.

### BigInt serialization

chat-svc patches `BigInt.prototype.toJSON` in `src/index.ts` to serialize as strings. Prisma uses `BigInt` for `sequenceNo`. Do not remove this patch.

---

## Environment variables

### Root `.env` (Docker infra)

```
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / POSTGRES_PORT
REDIS_PASSWORD / REDIS_PORT
PGADMIN_EMAIL / PGADMIN_PASSWORD / PGADMIN_PORT
```

### `services/user-svc/.env`

```
PORT=4001
DATABASE_URL=postgresql://...@localhost:5432/digiability_db?schema=public
JWT_PRIVATE_KEY=...        # RS256 private key — literal \n for line breaks
JWT_PUBLIC_KEY=...         # RS256 public key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
COOKIE_SECRET=...
MAIL_HOST / MAIL_USER / MAIL_PASS / EMAIL_FROM
CLIENT_BASE_URL=http://localhost:3000
REDIS_URL=redis://:password@localhost:6379
```

### `services/chat-svc/.env`

```
PORT=4002
SERVER_ID=chat-svc-local-01     # unique per instance; used for Redis Pub/Sub routing
DATABASE_URL=...?schema=chat    # "chat" schema, not "public"
REDIS_URL=redis://:password@localhost:6379
JWT_PUBLIC_KEY=...              # same public key as user-svc — copy it
CLIENT_BASE_URL=http://localhost:3000
REGISTRY_TTL_SECONDS=120        # session TTL in Redis
HEARTBEAT_INTERVAL_MS=30000     # client ping interval
```

### `services/forum-svc/.env`

```
PORT=4003
DATABASE_URL=...?schema=forum
JWT_PUBLIC_KEY=...              # same public key
NOTIF_SVC_URL=http://localhost:4004
```

### `apps/mobile/.env`

```
EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:4001   # LAN IP required for physical devices — not localhost
```

---

## Mobile app

### Path aliases (tsconfig.json + babel.config.js must both define these)

| Alias | Resolves to |
|---|---|
| `@store/*` | `src/store/*` |
| `@services/*` | `src/services/*` |
| `@screens/*` | `src/screens/*` |
| `@navigation/*` | `src/navigation/*` |
| `@components/*` | `src/components/*` |
| `@hooks/*` | `src/hooks/*` |
| `@assets/*` | `assets/*` |

### Navigation structure

```
RootNavigator
  ├── AuthNavigator     (Splash, Welcome, Login/Register, VerifyEmail, ForgotPassword, RoleSelection, AccessibilityScreen)
  └── MainNavigator     (NativeStack)
        ├── MainTabs    (bottom tabs: Home, Community, Services, Learn, Profile)
        │     └── CommunityScreen → tabs: Chats, Groups, Care Circles, Forums, Mentors
        └── Chats       (ChatsStack — pushed modal-style over tabs)
              ├── ConversationList
              ├── Chat (DM)
              ├── GroupChat
              ├── CreateGroup
              ├── GroupInfo
              ├── Invites
              └── UserProfile
```

**Navigation gotcha**: ChatsStack screens are registered as `"Chats"` in MainNavigator. Navigate from tab components using nested navigation:
```typescript
navigation.navigate("Chats", {
  screen: "GroupChat",
  params: { conversationId, groupName, subType },
} as any);
```

### Zustand stores (mobile)

| Store | File | Purpose |
|---|---|---|
| `useAuthStore` | `src/store/authStore.ts` | JWT tokens, user, onboarding state |
| `useChatStore` | `src/store/chatStore.ts` | Conversations, messages, presence, pending invites |
| `useForumStore` | `src/store/forumStore.ts` | Forum posts |
| `useGroupStore` | `src/store/groupStore.ts` | Group state |
| `useAccessibilityStore` | `src/store/accessibilityStore.ts` | Accessibility preferences (persisted per userId) |
| `usePresenceStore` | `src/store/presenceStore.ts` | Online/offline presence |

Session restore on boot: `RootNavigator` reads refresh token from `expo-secure-store`, calls `getMe()` silently, populates auth store.

---

## Web app

Vite 8 + React 19 + React Router 6. Routes:

- `/` → redirect to `/app/chats` or `/login`
- `/login`, `/register`, `/verify-email` → `AuthLayout`
- `/onboarding/accessibility`, `/onboarding/role`, `/onboarding/profile` → `OnboardingLayout`
- `/app/chats/:conversationId` → `ChatsLayout` + `ChatView` (DMs)
- `/app/groups/:conversationId` → `ChatsLayout` + `ChatView` (General Groups)
- `/app/care-circles/:conversationId` → `ChatsLayout` + `ChatView` (Care Circles)
- `/app/mentors`, `/app/forums`, `/app/events`, `/app/services`, `/app/learn`

`ChatsLayout` detects conversation type via `location.pathname` prefix.

`apiClient` (`src/services/apiClient.ts`): Axios instance with request interceptor (attach `Bearer` token) and response interceptor (silent 401 → `/api/auth/refresh` → retry queued requests). Refresh token read from `localStorage`.

---

## Admin panel

Next.js 15 App Router. Port 3001. Some API routes proxy to user-svc/chat-svc; others query PostgreSQL directly via `pg` Pool.

Structure:
- `app/(auth)/login` — admin login
- `app/(dashboard)/*` — users, groups, events, forums, moderation, notifications, analytics, settings
- `app/api/*` — Next.js API routes

The moderation section (`/moderation`, `/moderation/appeals`, `/moderation/audit-log`, `/moderation/keyword-filters`) is scaffolded but backend enforcement is still in progress.

---

## Group vs Care Circle

Both are `type: "GROUP"` conversations with `subType: "GENERAL"` or `"CARE_CIRCLE"`.

| Attribute | General Group | Care Circle |
|---|---|---|
| `subType` | `GENERAL` | `CARE_CIRCLE` |
| `maxMembers` | 256 | 15 |
| Admin roles | OWNER, ADMIN | OWNER, CAREGIVER |
| All valid roles | OWNER, ADMIN, MEMBER | OWNER, CAREGIVER, MENTOR, PROFESSIONAL, MEMBER |

`hasAdminAccess(role, subType)` in `services/chat-svc/src/services/conversation.service.ts` handles the branching.

---

## WebSocket protocol

WS endpoint: `ws://localhost:4002/ws?token=<accessToken>&deviceId=<uuid>`

All messages use a JSON envelope:
```typescript
{ event: string; requestId?: string; data: unknown; timestamp: number }
```

**Client → Server**: `message.send`, `message.delivered`, `message.read`, `message.delete`, `typing.start`, `typing.stop`, `session.ping`, `sync.request`

**Server → Client**: `message.ack`, `message.new`, `message.delivered.receipt`, `message.read.receipt`, `message.deleted`, `presence.update`, `typing.start.broadcast`, `typing.stop.broadcast`, `session.pong`, `sync.response`, `error`, `invite.new`, `invite.accepted`, `invite.declined`, `invite.cancelled`, `member.joined`, `member.left`, `member.removed`, `member.role.updated`, `group.settings.updated`, `group.info.updated`

Full definitions: `services/chat-svc/src/types/ws-events.ts`

---

## Roadmap context

Upcoming work (as of June 2026) — keep in mind when making changes:

- **Content moderation**: Admin moderation pages are scaffolded. Backend enforcement (keyword filters, appeals, audit log) is not yet built. forum-svc uses the `bad-words` npm package for basic client-side profanity filtering.
- **Security hardening**: Ongoing — rate limiting, input sanitization, token storage review.
- **Privacy / DPDP compliance**: India's Digital Personal Data Protection Act. Affects data retention, consent flows, and data export/deletion. When adding new data fields, consider: does this need to be deletable? Does it require user consent?
- **In-app account deletion**: `deleteAccount()` exists in `services/user-svc/src/services/auth.service.ts` and cascades via Prisma. Mobile/web UI flow is in progress.
- **App store launch**: iOS and Android. Expo push tokens are registered in `device_tokens` table; notif-svc sends via Expo Push API.
