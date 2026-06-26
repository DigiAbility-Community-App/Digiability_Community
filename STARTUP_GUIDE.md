# 🚀 Digiability Community — Startup Guide

Complete guide to run the full stack from scratch.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | ≥ 18.x | `node -v` |
| **npm** | ≥ 9.x | `npm -v` |
| **Docker Desktop** | Latest | `docker -v` |

> **Docker Desktop must be running** before any `docker compose` command.

---

## Architecture

| Service | Port | Runs in | Purpose |
|---------|------|---------|---------|
| `postgres` | 5432 | Docker | All persistent data (two schemas: public + chat) |
| `redis` | 6379 | Docker | Redis Streams (message pipeline) + Pub/Sub + session registry |
| `user-svc` | 4001 | Docker | Auth, JWT, profiles, OTP email, events, mentors |
| `chat-svc` | 4002 | Docker | WebSocket, REST chat API, embedded msg + delivery workers |
| `notif-svc` | 4004 | Docker | Push notification worker (Redis stream consumer) |
| `forum-svc` | 4003 | Local | Forum posts, comments |
| `web` | 3000 | Local | Vite + React desktop app |
| `admin` | 3001 | Local | Next.js admin dashboard |
| `mobile` | — | Expo | React Native (iOS / Android) |

> **Message workers** (persistence + delivery) are **embedded inside chat-svc** and start automatically. No separate worker containers are needed.

---

## Step 1 — Install Dependencies

```bash
# From the project root
npm install

# Services that run locally need their own install:
cd services/forum-svc  && npm install && cd ../..
cd apps/web            && npm install && cd ../..
cd apps/admin          && npm install && cd ../..
cd apps/mobile         && npm install && cd ../..

# user-svc and chat-svc: needed for Prisma CLI commands even though they run in Docker
cd services/user-svc   && npm install && cd ../..
cd services/chat-svc   && npm install && cd ../..
```

---

## Step 2 — Verify Environment Files

All `.env` files ship with working development values. Confirm they exist:

```bash
ls .env                        # Root — Docker infrastructure secrets
ls services/user-svc/.env      # Auth service
ls services/chat-svc/.env      # Chat service
ls apps/mobile/.env            # Mobile app (physical device IP)
```

### Key values to check

**`.env` (root)**
```
POSTGRES_USER=digiability
POSTGRES_PASSWORD=digiability_secret
POSTGRES_DB=digiability_db
REDIS_PASSWORD=redis_secret
```

**`services/user-svc/.env`** — must have:
- `DATABASE_URL` pointing to `localhost:5432` (local Prisma CLI) 
- `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` — RS256 key pair (already populated)
- `MAIL_USER` + `MAIL_PASS` — Gmail App Password for OTP emails

**`services/chat-svc/.env`** — must have:
- `DATABASE_URL` with `?schema=chat`
- `REDIS_URL`
- `JWT_PUBLIC_KEY` — **same public key as user-svc** (already populated)

**`apps/mobile/.env`** — for physical device testing, set your machine's LAN IP:
```bash
# Find your IP:
ipconfig getifaddr en0        # macOS
ip route get 1 | awk '{print $7}' # Linux

# Then update:
EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:4001
```
> Emulators can use the default `http://10.0.2.2:4001` (Android) or `http://localhost:4001` (iOS Simulator) — no change needed.

---

## Step 3 — Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Wait ~30 seconds, then verify both are healthy:
docker compose ps
```

Expected output:

| Name | Status |
|------|--------|
| `digiability_postgres` | healthy |
| `digiability_redis` | healthy |

Manual health checks:
```bash
docker exec digiability_postgres pg_isready
docker exec digiability_redis redis-cli -a redis_secret PING
```

---

## Step 4 — Database Setup (Prisma)

Run once after first clone, or after schema changes:

```bash
# user-svc schema (schema=public)
cd services/user-svc
npx prisma generate
npx prisma db push
cd ../..

# chat-svc schema (schema=chat)
cd services/chat-svc
npx prisma generate
npx prisma db push
cd ../..

# forum-svc schema
cd services/forum-svc
npx prisma generate
npx prisma db push
cd ../..
```

---

## Step 5 — Seed the Bot User

Required once after the DB is set up:

```bash
cd services/user-svc
npm run db:seed-bot
```

Expected output:
```
✅ Bot user created/updated:
   ID:    00000000-0000-0000-0000-000000000001
   Email: bot@digiability.com
```

Bot login credentials: `bot@digiability.com` / `DigiBot@2024`

---

## Step 6 — Build & Start Backend Services (Docker)

```bash
# First time or after code changes — build images then start:
docker compose up -d --build user-svc chat-svc notif-svc

# Subsequent starts (no code changes):
docker compose up -d user-svc chat-svc notif-svc
```

Verify health:
```bash
curl http://localhost:4001/health   # → {"status":"healthy","service":"user-svc"}
curl http://localhost:4002/health   # → {"status":"healthy","service":"chat-svc"}
```

View live logs:
```bash
docker logs digiability_user_svc -f
docker logs digiability_chat_svc -f
```

---

## Step 7 — Start Local Services

> **IMPORTANT — DO NOT run `npm run dev` for these services — they are already running in Docker:**
> - `user-svc` (port 4001) — Docker only
> - `chat-svc` (port 4002) — Docker only
> - `notif-svc` (port 4004) — Docker only
>
> Running them locally will fail with `EADDRINUSE` (port already in use).

Only these four need `npm run dev` in a local terminal:

Open **separate terminal tabs** for each:

### Terminal 1 — forum-svc
```bash
cd services/forum-svc
npm run dev
# Expected: 🚀 forum-svc running on http://localhost:4003
```

### Terminal 2 — Web App
```bash
cd apps/web
npm run dev
# Expected: ➜ Local: http://localhost:3000
```

### Terminal 3 — Admin Panel
```bash
cd apps/admin
npm run dev -- -p 3001
# Expected: ▲ Next.js ready on http://localhost:3001
```

### Terminal 4 — Mobile App
```bash
cd apps/mobile
npx expo start
```

Select platform:
- `a` → Android emulator
- `i` → iOS simulator
- Scan QR code → Expo Go on physical device

---

## Step 8 — Full Stack Verification Checklist

### Auth & Onboarding
- [ ] Open app → Register with email + password
- [ ] OTP sent to email (or check `docker logs digiability_user_svc` for `[EmailService / DEV] OTP for <email>: <otp>`)
- [ ] Enter OTP → email verified
- [ ] Complete accessibility preferences
- [ ] Select role (PwD / Caregiver / Therapist / NGO / Volunteer / Student / Mentor)
- [ ] Complete profile details (name, DOB, city, etc.)
- [ ] Login with credentials → lands on home screen

### 1:1 Direct Messaging
- [ ] Community → Chats tab (shows DMs only — no groups here)
- [ ] Tap compose → search for DigiBot → start chat
- [ ] Send message → DigiBot appears in conversation list
- [ ] Login as DigiBot on second device/emulator → receive message
- [ ] Reply from DigiBot → appears on first device in real-time

### Groups
- [ ] Community → **Groups** tab (shows GENERAL groups only)
- [ ] Groups not a member of show a **Join** badge → tap to join
- [ ] FAB (+) → Create Group → enter name + description → add members → Create
- [ ] New group appears in Groups tab immediately
- [ ] Tap group → GroupChat opens → send messages
- [ ] Tap group header → GroupInfo screen:
  - [ ] Members list with role badges (Owner/Admin/Member)
  - [ ] Admin can toggle: Edit Group Info / Add Members / Send Messages / Approve New Members
  - [ ] Admin can change member roles
  - [ ] Admin can remove members
  - [ ] Non-owner members see Leave Group button
- [ ] Invite another user → they get invite notification
- [ ] Invited user: Community → Chats tab → tap bell icon → Pending Invites → Accept
- [ ] After accepting: navigates to GroupChat, new member appears in GroupInfo

### Care Circles
- [ ] Community → **Care Circles** tab (shows CARE_CIRCLE groups only)
- [ ] Same flow as Groups above — join, create, message, manage
- [ ] Create Care Circle: roles available = Member / Caregiver / Mentor / Professional
- [ ] Care Circles do **not** appear in Groups tab and vice versa
- [ ] DMs do **not** appear in either Groups or Care Circles tab

### Forums
- [ ] Community → Forums tab → posts load
- [ ] Create a post → appears in list
- [ ] Tap post → view comments → add comment
- [ ] Upvote/downvote works

### Notifications
- [ ] Receive a message while app is backgrounded → push notification appears
- [ ] Tap notification → opens correct conversation

### Web App (`http://localhost:3000`)
- [ ] Login → lands on `/app/chats` (DMs only)
- [ ] Sidebar: Chats (DM) | Groups | Care Circles | Mentors | Forums | Events
- [ ] `/app/groups` → shows GENERAL groups only, with "New Group" button
- [ ] `/app/care-circles` → shows CARE_CIRCLE groups only, with "New Care Circle" button
- [ ] Create group → appears in sidebar immediately
- [ ] Bell icon → Pending Invites panel → Accept → navigates to conversation
- [ ] Open a group → click ℹ️ icon → GroupInfoPanel slides in with member list + toggles
- [ ] Right-click a message → Delete for Me / Delete for Everyone

### Admin Panel (`http://localhost:3001`)
- [ ] Login with admin account
- [ ] Dashboard → stats cards load with real data
- [ ] Users → list loads, can view user detail
- [ ] Groups → list loads
- [ ] Forums → list loads with moderation controls
- [ ] Events → list loads
- [ ] Notifications → send broadcast notification
- [ ] Settings → loads

---

## Rebuilding After Code Changes

```bash
# Changed user-svc or chat-svc code:
docker compose up -d --build user-svc
docker compose up -d --build chat-svc

# Changed Prisma schema:
cd services/user-svc && npx prisma db push  # then rebuild Docker image
cd services/chat-svc && npx prisma db push

# Changed forum-svc: just restart npm run dev (hot reload handles it)
```

---

## Shutdown

```bash
# Stop all containers (data is preserved in volumes)
docker compose down

# Nuclear reset — removes all data:
docker compose down -v
npx prisma db push  # re-run steps 4–5 after this
```

---

## Troubleshooting

### ❌ OTP not received
Check the user-svc container logs:
```bash
docker logs digiability_user_svc | grep "OTP for"
```
Look for: `[EmailService / DEV] OTP for <email>: <otp>`

### ❌ "Cannot connect to database"
```bash
docker compose ps postgres        # Is it healthy?
docker compose up -d postgres     # Start it if not
```

### ❌ "WebSocket won't connect" on physical device
- Ensure `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env` uses your LAN IP, not `localhost`
- Run `ipconfig getifaddr en0` (Mac) to find it

### ❌ `EADDRINUSE` on port 4004 (notif-svc)
Port 4004 is held by the Docker container — this is expected. Do **not** run `npm run dev` for `notif-svc`. It runs in Docker only. Check it's healthy with:
```bash
curl http://localhost:4004/health
docker logs digiability_notif_svc -f
```

### ❌ Port 4001 or 4002 already in use
You have a stale local process. Kill it:
```bash
lsof -ti:4001 | xargs kill -9
lsof -ti:4002 | xargs kill -9
```

### ❌ "Prisma schema drift"
```bash
cd services/<service>
npx prisma db push --force-reset   # WARNING: deletes all data
npx prisma generate
```

### ❌ Docker service won't start
```bash
docker logs digiability_user_svc   # Read the error
docker logs digiability_chat_svc
docker compose up -d --build user-svc chat-svc  # Rebuild from scratch
```

---

## Open pgAdmin (Database UI)

```bash
docker compose --profile dev up -d pgadmin
# Open: http://localhost:5050
# Email: admin@digiability.com / Password: admin123
```

---

## Architecture Diagram

```
┌─────────────────────────── Docker Compose ──────────────────────────┐
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐   │
│  │  user-svc    │  │  chat-svc    │  │ postgres │  │   redis    │   │
│  │  :4001       │  │  :4002       │  │  :5432   │  │  :6379     │   │
│  │ Auth/Users/  │  │ WS + REST +  │  │          │  │ Streams +  │   │
│  │ Events/JWT   │  │ Workers      │  │          │  │ Pub/Sub    │   │
│  └──────────────┘  └──────────────┘  └──────────┘  └────────────┘   │
│                                                                       │
│  ┌──────────────┐                                                     │
│  │  notif-svc   │                                                     │
│  │  :4004       │                                                     │
│  └──────────────┘                                                     │
└───────────────────────────────────────────────────────────────────────┘

         Local processes (npm run dev)
  ┌──────────────┐
  │  forum-svc   │
  │    :4003     │
  └──────────────┘

         Frontend (local dev servers)
  ┌───────────┐  ┌───────────┐  ┌─────────────┐
  │  Mobile   │  │  Web App  │  │ Admin Panel │
  │  (Expo)   │  │   :3000   │  │    :3001    │
  └───────────┘  └───────────┘  └─────────────┘
```

---

**Last Updated:** June 2026 | **Node.js:** ≥ 18 | **Docker:** Required
