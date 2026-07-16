# notif-svc — Push Notification Worker

Consumes Redis Streams and sends push notifications through the **Expo Push API**. Built with **Node.js, TypeScript, raw `http`, `pg`, and `expo-server-sdk`**.

Runs on **port 4004**. This is primarily a **background worker** — the HTTP surface is just a health check and one internal endpoint.

Unlike the other services it uses **no Express and no Prisma**: a raw `http` server and a `pg` Pool that reads the `device_tokens` table directly from the `public` schema.

---

## Quick Start

```bash
# From the monorepo root
npm install

cp .env.example .env
# Fill in DATABASE_URL and REDIS_URL

# Start infrastructure (from the repo root)
docker compose up -d postgres redis

npm run dev          # → http://localhost:4004
curl http://localhost:4004/health
```

Or run it containerized from the repo root: `docker compose up -d --build notif-svc`.

No SMTP or Expo access token is required — standard Expo pushes are unauthenticated.

---

## Endpoints

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok" }` |
| POST | `/internal/notify` | **none** | `{ userId, title, body, data? }` → look up the user's Expo tokens and push |

> ⚠️ `/internal/notify` has **no authentication** — it relies entirely on network isolation. Do not expose this service publicly. In the live deployment it is cluster-internal only and is not given a NodePort.

---

## Redis Stream Consumers

notif-svc is the terminal consumer of two streams:

| Stream | Producer | Meaning |
|---|---|---|
| `msg:notify` | chat-svc `delivery.worker` | recipient was offline — push the chat message |
| `forum:notify` | forum-svc | forum activity (new answer, vote, etc.) |

```
chat-svc delivery.worker ──→ Stream msg:notify   ─┐
                                                  ├─→ notif-svc ─→ device_tokens (pg) ─→ Expo Push API
forum-svc ───────────────→ Stream forum:notify  ─┘
```

forum-svc **also** calls `POST /internal/notify` over HTTP for some paths, so this service is reachable both ways.

---

## Device Tokens

Push targets live in the `device_tokens` table (`public` schema), owned by **user-svc** — notif-svc only reads it.

Clients register their Expo push token through user-svc, not here:

```
POST   /api/auth/device-token      (user-svc :4001)   { token, platform }
DELETE /api/auth/device-token      (user-svc :4001)   — on logout
```

Because notif-svc reads a user-svc-owned table with raw SQL rather than Prisma, a schema change to `device_tokens` will **not** surface as a TypeScript error here. Check this service whenever that table changes.

---

## Configuration

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 4004) |
| `DATABASE_URL` | PostgreSQL — `public` schema, no schema param needed |
| `REDIS_URL` | Stream consumer connection |

See [`.env.example`](./.env.example) and [`docs/env-guide.md`](../../docs/env-guide.md).

---

## Related Docs

| Doc | Path |
|-----|------|
| Architecture | [`docs/architecture.md`](../../docs/architecture.md) |
| WebSocket Events | [`docs/websocket-events.md`](../../docs/websocket-events.md) |
