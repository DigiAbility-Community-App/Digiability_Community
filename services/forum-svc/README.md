# forum-svc — Forum Q&A & Realtime

Community Q&A: questions, answers, votes, bookmarks, reports, and notifications, with **Socket.io** realtime. Built with **Node.js, TypeScript, Express, Prisma (PostgreSQL `public` schema), and Socket.io**.

Runs on **port 4003**.

---

## Quick Start

```bash
# From the monorepo root
npm install

cp .env.example .env
# Fill in DATABASE_URL, JWT_PUBLIC_KEY, NOTIF_SVC_URL

# Start infrastructure (from the repo root)
docker compose up -d postgres

npx prisma migrate deploy
npm run db:generate

npm run dev          # → http://localhost:4003
curl http://localhost:4003/health
```

Or run it containerized from the repo root: `docker compose up -d --build forum-svc`. Running it locally with `npm run dev` is mainly for hot-reload during development.

> `JWT_PUBLIC_KEY` must be the **same public key** user-svc signs with. forum-svc only verifies tokens — it never signs them.

---

## Endpoints — `/api/forum`

All routes require `Authorization: Bearer <accessToken>`.

| Area | Method | Endpoint |
|---|---|---|
| Questions | POST / GET | `/questions` |
| Duplicate check | GET | `/questions/check-duplicates` |
| Single question | GET / DELETE | `/questions/:id` |
| AI summary | GET | `/questions/:id/summary` |
| Reopen | POST | `/questions/:id/reopen` |
| Answers | POST | `/questions/:questionId/answers` |
| Edit / delete answer | PUT / DELETE | `/answers/:id` |
| Vote | POST | `/answers/:id/vote` — `{ type: "UP" \| "DOWN" }` |
| Accept answer | POST | `/answers/:id/accept` |
| Reports | POST | `/reports` |
| Bookmarks | POST / GET | `/bookmarks` |
| Notifications | GET / PUT | `/notifications`, `/notifications/read-all`, `/notifications/:id/read` |
| My stats | GET | `/me/stats` |

Question and answer creation accept image and audio uploads and run them through moderation.

### Question categories

`category` is validated against a fixed allowlist — anything else returns **400 `Invalid category`**:

```
Healthcare · Government Schemes · Accessibility · Education · Jobs
Mental Health · Legal Help · Assistive Technology · Caregiver Support · Community
```

### Internal

| Method | Endpoint | Purpose |
|---|---|---|
| DELETE | `/api/internal/users/:userId/content` | Erasure hook for account deletion — gated by `x-internal-secret` |

---

## Realtime (Socket.io)

```typescript
io("http://localhost:4003", { auth: { token }, transports: ["websocket"] });
```

Broadcast events: `question_created`, `question_deleted`, `question_reopened`, `answer_created`, `answer_updated`, `answer_deleted`, `answer_voted`, `answer_accepted`
Per-user event: `notification`

Socket.io CORS is `origin: "*"`, and the Express CORS reflects any origin — unlike user-svc/chat-svc, forum-svc is **not** restricted to a single `CLIENT_BASE_URL`.

> The **web app does not use forum realtime** — it is wired up on mobile only (`forumSocketService.ts`).

---

## Push Notifications

Forum activity notifies users two ways:

- **HTTP** — `POST ${NOTIF_SVC_URL}/internal/notify`
- **Redis Stream** — `forum:notify`, consumed by notif-svc

> ⚠️ Always set `NOTIF_SVC_URL` explicitly. The in-code fallback is `http://localhost:4003` — forum-svc's *own* port, not notif-svc's `4004` — so an unset value silently breaks push instead of failing loudly.

---

## Database

### ⚠️ `public` is shared with user-svc

Despite the name, forum-svc does **not** use a `forum` schema — its tables live in **`public`**, alongside user-svc's. Leave the `?schema=` param off `DATABASE_URL` (docker-compose does too).

`prisma db push` fully reconciles everything it can see in the target schema, so a push from **either** service will **drop the other's tables** unless both `schema.prisma` files keep their inert **stub mirror models** in sync. This file declares stubs for user-svc's `User`, `MentorProfile`, `Event`, `DeviceToken`, `UserReport`, and `AdminAuditLog` purely so a push doesn't delete them.

**If you add or change a model in `public`, mirror the identical change into user-svc's stub block.** Outside local dev, prefer `prisma migrate deploy` over `db push`.

Owned tables: `forum_questions`, `forum_answers`, `forum_votes`, `forum_tags`, `forum_reports`, `forum_user_stats`, `forum_bookmarks`, `forum_notifications`.

---

## Architecture

```
src/
├── server.ts               ← Express app + Socket.io + startup
├── routes/forum.routes.ts  ← single route file, mounted at /api/forum
├── controllers/            ← request/response handling
├── services/               ← business logic
├── websocket/socket.ts     ← Socket.io setup + broadcast helpers
├── middleware/             ← auth, error, validate
├── models/prisma.client.ts
└── utils/                  ← validation.util.ts (Zod), profanity.ts (bad-words)
```

Profanity filtering uses the `bad-words` package; deeper AI moderation lives in user-svc.

---

## Related Docs

| Doc | Path |
|-----|------|
| API Reference | [`docs/api-reference.md`](../../docs/api-reference.md) |
| Architecture | [`docs/architecture.md`](../../docs/architecture.md) |
| Env Setup Guide | [`docs/env-guide.md`](../../docs/env-guide.md) |
| Monorepo overview | [`README.md`](../../README.md) |
