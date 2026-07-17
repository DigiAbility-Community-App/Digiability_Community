# chat-svc — Chat, Groups & Real-time Messaging

WebSocket gateway and REST API for direct messages, Groups, and Care Circles. Built with **Node.js, TypeScript, Express, `ws`, Prisma (PostgreSQL `chat` schema), and Redis**.

Runs on **port 4002**. The message and delivery workers are **embedded in this process** and start automatically on boot — no separate containers.

---

## Quick Start

```bash
# From the monorepo root
npm install

cp .env.example .env
# Fill in DATABASE_URL (schema=chat), REDIS_URL, and JWT_PUBLIC_KEY

# Start infrastructure (from the repo root)
docker compose up -d postgres redis

# Apply migrations + generate the client
npx prisma migrate deploy
npm run db:generate

npm run dev          # → http://localhost:4002
curl http://localhost:4002/health
```

Or run it containerized from the repo root: `docker compose up -d --build chat-svc`.

> `JWT_PUBLIC_KEY` must be the **same public key** user-svc signs with. chat-svc only *verifies* tokens — it never signs them and makes no runtime HTTP calls to user-svc.

---

## REST Endpoints

All routes require an `Authorization: Bearer <accessToken>` header.

| Area | Method | Endpoint |
|---|---|---|
| Conversations | POST / GET | `/api/conversations` |
| Group discovery | GET | `/api/conversations/groups` |
| Single conversation | GET | `/api/conversations/:id` |
| Group info / settings | PATCH | `/api/conversations/:id` · `/:id/settings` |
| Members | POST / DELETE / PATCH | `/api/conversations/:id/members…` |
| Ownership | POST | `/api/conversations/:id/transfer-ownership` |
| Join / approve | POST | `/api/conversations/:id/join` · `/:id/join-requests/:inviteId/approve` |
| Mute / pin | POST | `/api/conversations/:id/mute` · `/:id/pin` |
| Message history | GET | `/api/messages/:id/history` · `/:id/missed` |
| Unread counts | GET | `/api/messages/unread/counts` |
| Invites | POST / GET | `/api/invites/send` · `/pending` · `/count` · `/:inviteId/respond` |
| Presence | GET | `/api/presence/:userId` |
| Media upload | POST | `/api/media/upload` |
| Internal (secret-gated) | — | `/api/internal/*` |

---

## WebSocket

```
ws://localhost:4002/ws?token=<accessToken>&deviceId=<uuid>
```

The JWT is verified on upgrade. Origin is **not** checked, so CORS does not apply to the socket (native clients may send the token in an `Authorization` header instead of the query string).

Every frame uses one envelope:

```typescript
{ event: string; requestId?: string; data: unknown; timestamp: number }
```

**Client → Server:** `message.send`, `message.delivered`, `message.read`, `message.delete`, `typing.start`, `typing.stop`, `session.ping`, `sync.request`

**Server → Client:** `message.ack`, `message.new`, `message.deleted`, `message.delivered.receipt`, `message.read.receipt`, `presence.update`, `typing.*.broadcast`, `session.pong`, `sync.response`, `error`, `invite.*`, `member.*`, `group.settings.updated`, `group.info.updated`

Full definitions: [`src/types/ws-events.ts`](./src/types/ws-events.ts) · [`docs/websocket-events.md`](../../docs/websocket-events.md)

---

## Message Pipeline

```
Client WS → event-router → publishMessageCreated() → Stream msg:created
                                                   → [ACK sent immediately]
msg-svc.worker    XREADGROUP msg:created   → persist (Prisma) → Stream msg:persisted
delivery.worker   XREADGROUP msg:persisted → look up sessions in Redis
                    ├─ online  → Pub/Sub ws:deliver:{serverId} → connectionManager
                    └─ offline → Stream msg:notify → notif-svc → Expo Push
```

The sender is ACKed before persistence, so the ACK confirms *acceptance*, not durability.

---

## Group vs Care Circle

Both are `type: "GROUP"` conversations distinguished by `subType`:

| | General Group | Care Circle |
|---|---|---|
| `subType` | `GENERAL` | `CARE_CIRCLE` |
| `maxMembers` | 256 | 15 |
| Admin roles | OWNER, ADMIN | OWNER, CAREGIVER |
| All roles | OWNER, ADMIN, MEMBER | OWNER, CAREGIVER, MENTOR, PROFESSIONAL, MEMBER |

`hasAdminAccess(role, subType)` in [`src/services/conversation.service.ts`](./src/services/conversation.service.ts) handles the branching.

---

## Architecture

chat-svc is the only service with a **repository layer** between services and Prisma.

```
src/
├── index.ts            ← Express + WS server, worker startup, BigInt patch
├── routes/ controllers/ services/
├── repositories/       ← the only layer that touches Prisma directly
├── websocket/          ← gateway.ts, event-router.ts, handlers/, connection-manager.ts
├── workers/            ← msg-svc.worker.ts, delivery.worker.ts (embedded)
├── streams/            ← producer.ts, constants.ts
├── config/             ← env.ts (fail-fast validation), redis.ts, logger.ts
├── types/              ← ws-events.ts, message.types.ts
└── utils/
```

> **Do not remove the `BigInt.prototype.toJSON` patch in `src/index.ts`.** Prisma uses `BigInt` for `sequenceNo`, which is not JSON-serializable by default.

---

## Database

Uses the **`chat` schema** (not `public`), so it is fully isolated from user-svc/forum-svc and safe from their `db push` reconciliation.

Tables: `conversations`, `conversation_members`, `messages`, `message_recipients`, `message_receipts`, `group_invites`, `outbox_events`, `hidden_messages`, `blocked_users`, `reports`.

> The original init migration predates Groups, Care Circles, and invites; migration `20260711120000_reconcile_group_invite_schema` adds the missing columns/tables and is idempotent. If this database was bootstrapped with `db push` (no migration history), baseline it once before deploying:
> ```bash
> npx prisma migrate resolve --applied 20260426091650_init_chat
> ```

---

## Scaling notes

`SERVER_ID` must be **unique per instance** — it keys the Redis session registry (`ws:server:{serverId}`) that routes Pub/Sub delivery to the instance holding a given connection. Duplicate IDs across instances will misroute messages.

---

## Related Docs

| Doc | Path |
|-----|------|
| WebSocket Events | [`docs/websocket-events.md`](../../docs/websocket-events.md) |
| API Reference | [`docs/api-reference.md`](../../docs/api-reference.md) |
| Architecture | [`docs/architecture.md`](../../docs/architecture.md) |
