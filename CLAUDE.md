# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Daily startup (Docker-first)
```bash
# Start infrastructure + core backend services
docker compose up -d postgres redis
docker compose up -d --build user-svc chat-svc notif-svc

# After code changes to user-svc or chat-svc, rebuild only that service:
docker compose up -d --build chat-svc

# Verify both services are healthy:
curl http://localhost:4001/health
curl http://localhost:4002/health
```

### Local-only services (run in separate terminals)
```bash
cd services/forum-svc && npm run dev    # port 4003
cd apps/web       && npm run dev        # port 3000
cd apps/admin     && npm run dev -- -p 3001  # port 3001
cd apps/mobile    && npx expo start     # Expo DevTools
```

### Prisma database management
```bash
# After editing a prisma/schema.prisma — push schema without migrations (dev only)
cd services/user-svc  && npx prisma db push
cd services/chat-svc  && npx prisma db push
cd services/forum-svc && npx prisma db push

# Regenerate Prisma client after schema changes
cd services/user-svc  && npx prisma generate
cd services/chat-svc  && npx prisma generate

# Open Prisma Studio (visual DB browser)
cd services/user-svc  && npm run db:studio
cd services/chat-svc  && npm run db:studio

# Seed the DigiBot user (required once after DB setup)
cd services/user-svc && npm run db:seed-bot
```

### TypeScript checks (all packages)
```bash
cd services/chat-svc && npx tsc --noEmit
cd services/user-svc && npx tsc --noEmit
cd apps/web          && npx tsc --noEmit
cd apps/mobile       && npx tsc --noEmit
```

### Logs
```bash
docker logs digiability_chat_svc -f
docker logs digiability_user_svc -f
docker logs digiability_postgres -f
```

---

## Architecture

### Service Map

| Service | Port | Runtime | Responsibility |
|---|---|---|---|
| `user-svc` | 4001 | Docker | Auth, JWT, profiles, OTP email, events, mentors |
| `chat-svc` | 4002 | Docker | WebSocket, REST chat API, embedded workers |
| `forum-svc` | 4003 | Local | Forum posts, comments, Socket.io |
| `notif-svc` | 4004 | Docker | Push notification worker (Redis stream consumer) |
| `postgres` | 5432 | Docker | All persistent data (two Prisma schemas) |
| `redis` | 6379 | Docker | Redis Streams (message pipeline) + Pub/Sub + session registry |
| `web` | 3000 | Local | Vite + React (desktop) |
| `admin` | 3001 | Local | Next.js admin dashboard |
| `mobile` | — | Expo | React Native (iOS/Android) |

### Message Pipeline (Critical Path)

```
Client WS send
  → event-router.ts (chat-svc/src/websocket/event-router.ts)
  → message.handler.ts → publishMessageCreated() → Redis Stream msg:created
  → [ACK to sender immediately]

msg-svc.worker.ts (embedded in chat-svc)
  → reads msg:created → persistMessage() (Prisma/PostgreSQL)
  → publishMessagePersisted() → Redis Stream msg:persisted

delivery.worker.ts (embedded in chat-svc)
  → reads msg:persisted → getRecipientSessions() from Redis registry
  → Pub/Sub publish to ws:deliver:{serverId}

delivery.service.ts (Pub/Sub subscriber)
  → connectionManager.sendToUser() → client receives message.new WS event
```

Both workers start **automatically** when chat-svc starts (`index.ts` lines 114-117). No separate worker processes.

### Authentication Flow

- **user-svc** signs JWT (RS256 private key). Issues short-lived access token + long-lived refresh token.
- **chat-svc** verifies JWT using the **public key only** (`JWT_PUBLIC_KEY` env var). Never has the private key.
- Mobile: access token stored in Zustand (in-memory); refresh token in `SecureStore`.
- Web: access token in Zustand; refresh token in `localStorage`.
- On 401: `apiClient` interceptor silently refreshes via `POST /api/auth/refresh` with the stored refresh token.

### Two Separate Prisma Schemas

`user-svc` and `chat-svc` each have their own `prisma/schema.prisma` with separate generated clients at `src/generated/client`. They share the same PostgreSQL instance but use different schemas (`public` vs `chat`).

- user-svc schema: `User`, `UserProfile`, `MentorProfile`, `Event`, `RefreshToken`, `DeviceToken`, etc.
- chat-svc schema: `Conversation`, `ConversationMember`, `Message`, `MessageRecipient`, `GroupInvite`, etc.

### Path Aliases (Mobile)

Configured in both `tsconfig.json` and `babel.config.js`:

| Alias | Resolves to |
|---|---|
| `@store/*` | `src/store/*` |
| `@services/*` | `src/services/*` |
| `@screens/*` | `src/screens/*` |
| `@navigation/*` | `src/navigation/*` |
| `@components/*` | `src/components/*` |
| `@hooks/*` | `src/hooks/*` |

### Mobile Navigation Structure

```
RootNavigator
  └── AuthNavigator     (login, register, verify-email)
  └── MainNavigator     (NativeStack)
        ├── MainTabs    (Bottom tabs: Home, Community, Services, Learn, Profile)
        │     └── CommunityDetail → has tab bar with Chats/Groups/Care Circles
        └── Chats       (ChatsStack — pushed on top of tabs)
              ├── ConversationList
              ├── Chat (DM)
              ├── GroupChat
              ├── CreateGroup
              ├── GroupInfo
              ├── Invites
              └── UserProfile
```

**Navigation gotcha**: Screens inside `ChatsStack` are registered as `"Chats"` in `MainNavigator`. When navigating to them from tab components (e.g., `GroupsTab`), always use nested navigation:
```typescript
navigation.navigate("Chats", {
  screen: "GroupChat",
  params: { conversationId, groupName, subType },
} as any);
```

### Web App Structure (Vite + React)

Routes under `/app/*` are protected. `MainLayout` wraps all authenticated routes and manages the sidebar nav and socket lifecycle.

- `/app/chats/:conversationId` → `ChatsLayout` + `ChatView` (DMs + Care Circles)
- `/app/groups/:conversationId` → `ChatsLayout` + `ChatView` (General Groups)

`ChatsLayout` determines which conversation type to show via `location.pathname.includes('/app/groups')`.

### Key Stores (Zustand)

**Mobile & Web both use Zustand.** Mobile has additional stores:

| Store | File | Purpose |
|---|---|---|
| `useAuthStore` | `src/store/authStore.ts` | JWT tokens, user, onboarding pending state |
| `useChatStore` | `src/store/chatStore.ts` | Conversations, messages, presence, pending invites |
| `useForumStore` | `src/store/forumStore.ts` (mobile only) | Forum posts |
| `useGroupStore` | `src/store/groupStore.ts` (mobile only) | Group state |

### Real-time Events (WebSocket)

WS events are defined in `services/chat-svc/src/types/ws-events.ts`. The client uses the same event name strings:
- `message.send` / `message.new` / `message.ack` / `message.deleted`
- `invite.new` / `invite.accepted` / `invite.declined`
- `member.joined` / `member.left` / `member.removed` / `member.role.updated`
- `group.settings.updated` / `group.info.updated`
- `typing.start` / `typing.stop.broadcast` / `presence.update`
- `sync.request` / `sync.response`

### Mobile API Base URL

Mobile `chatService.ts` derives chat-svc URL by replacing port 4001 → 4002 on `EXPO_PUBLIC_API_BASE_URL`. For physical devices, `apps/mobile/.env` must have the machine's LAN IP, not `localhost`:
```
EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:4001
```

### Group vs Care Circle

Both are `type: "GROUP"` conversations with `subType: "GENERAL"` or `"CARE_CIRCLE"`. The distinction affects:
- Which roles are valid (Care Circle: OWNER/CAREGIVER/MENTOR/PROFESSIONAL/MEMBER; Group: OWNER/ADMIN/MEMBER)
- Admin permission checks (`hasAdminAccess()` in conversation.service.ts)
- `maxMembers` (Care Circle: 15, General: 256)

### Admin Panel

Next.js 13+ App Router. API routes at `app/api/*` proxy to user-svc/chat-svc. Dashboard pages at `app/(dashboard)/*`. Auth at `app/(auth)/login`. Runs on port 3001 to avoid conflict with web on 3000.

---

## Environment Variables Reference

| Service | Key env vars |
|---|---|
| Root `.env` | `POSTGRES_USER/PASSWORD/DB`, `REDIS_PASSWORD` |
| `user-svc/.env` | `DATABASE_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `MAIL_USER`, `MAIL_PASS` |
| `chat-svc/.env` | `DATABASE_URL` (schema=chat), `REDIS_URL`, `JWT_PUBLIC_KEY` |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_BASE_URL` (LAN IP for physical device testing) |

`chat-svc` needs only the JWT **public key**. The private key lives only in `user-svc`.
