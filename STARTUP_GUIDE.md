# 🚀 Digiability Community — Startup Guide

Step-by-step guide to start the entire project stack from scratch.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | ≥ 18.x | `node -v` |
| **npm** | ≥ 9.x | `npm -v` |
| **Docker Desktop** | Latest | `docker -v` |
| **Docker Compose** | ≥ 2.x | `docker compose version` |

> [!IMPORTANT]
> Make sure Docker Desktop is **running** before you start. PostgreSQL and Redis run in Docker containers. user-svc and chat-svc also run as Docker containers (built from their Dockerfiles).

---

## Current Architecture Overview

| Layer | What runs where |
|-------|----------------|
| **PostgreSQL, Redis** | Docker container |
| **user-svc** (:4001) | Docker container (built from `services/user-svc/Dockerfile`) |
| **chat-svc** (:4002) | Docker container (built from `services/chat-svc/Dockerfile`) — msg & delivery workers embedded |
| **forum-svc** (:4003) | Local `npm run dev` |
| **notif-svc** | Local `npm run dev` (Redis stream consumer worker) |
| **Mobile App** | Expo (local) |
| **Web App** (:3000) | Local `npm run dev` (Vite + React) |
| **Admin Panel** (:3001) | Local `npm run dev` (Next.js) |

> [!NOTE]
> Cassandra has been removed. Messages are now stored in PostgreSQL.

---

## Step 1: Install Dependencies

Install dependencies for services that run **locally** (Docker handles user-svc and chat-svc at build time, but you still need them locally for Prisma CLI commands):

```bash
# Install root workspace dependencies
npm install

# Install user-svc (needed for prisma db push)
cd services/user-svc && npm install && cd ../..

# Install chat-svc (needed for prisma db push)
cd services/chat-svc && npm install && cd ../..

# Install forum-svc
cd services/forum-svc && npm install && cd ../..

# Install mobile app dependencies
cd apps/mobile && npm install && cd ../..

# Install web app dependencies
cd apps/web && npm install && cd ../..

# Install admin app dependencies
cd apps/admin && npm install && cd ../..
```

---

## Step 2: Environment Variables

The project ships with working `.env` files for development. Verify they exist:

```bash
# Root .env (Docker infrastructure secrets)
cat .env

# user-svc .env
cat services/user-svc/.env

# chat-svc .env
cat services/chat-svc/.env
```

Key environment variables:
- **Root**: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`
- **user-svc**: `DATABASE_URL`, `JWT_PRIVATE_KEY`, `MAIL_*` (SMTP credentials)
- **chat-svc**: `DATABASE_URL`, `REDIS_URL`, `JWT_PUBLIC_KEY`

> [!TIP]
> If you need to change SMTP credentials, update `MAIL_USER` and `MAIL_PASS` in `services/user-svc/.env`.

---

## Step 3: Start Database Infrastructure

Start only the database containers first — you need these running before the Prisma setup steps:

```bash
docker compose up -d postgres redis
```

### Wait for containers to be healthy:

```bash
# Check status (repeat until both show "healthy")
docker compose ps
```

**Expected output after ~30 seconds:**

| Container | Status |
|-----------|--------|
| `digiability_postgres` | healthy |
| `digiability_redis` | healthy |

You can verify manually:
```bash
# Test PostgreSQL
docker exec digiability_postgres pg_isready

# Test Redis
docker exec digiability_redis redis-cli -a redis_secret PING
```

---

## Step 4: Setup user-svc Database (Prisma)

```bash
cd services/user-svc

# Generate the Prisma client
npx prisma generate

# Push schema to PostgreSQL (creates tables)
npx prisma db push
```

> [!NOTE]
> `prisma db push` is used instead of `prisma migrate dev` for initial setup. For production, use `prisma migrate dev` to create tracked migrations.

---

## Step 5: Setup chat-svc Database (Prisma)

```bash
cd services/chat-svc

# Generate the Prisma client
npx prisma generate

# Push schema to PostgreSQL (creates tables)
npx prisma db push
```

---

## Step 6: Setup forum-svc Database (Prisma)

```bash
cd services/forum-svc

# Generate the Prisma client
npx prisma generate

# Push schema to PostgreSQL (creates tables)
npx prisma db push
```

---

## Step 7: Seed the Bot User

```bash
cd services/user-svc

npm run db:seed-bot
```

**Expected output:**
```
🤖 Seeding Digiability Bot user...

✅ Bot user created/updated:
   ID:       00000000-0000-0000-0000-000000000001
   Name:     Digiability Bot
   Email:    bot@digiability.com
   Verified: true

🔑 Login credentials:
   Email:    bot@digiability.com
   Password: DigiBot@2024
```

---

## Step 8: Build & Start Docker Services

Build and start user-svc and chat-svc as Docker containers:

```bash
# First time (or after code changes): build the images then start
docker compose up -d --build user-svc chat-svc
```

> [!TIP]
> On subsequent starts (no code changes), you can skip `--build`:
> ```bash
> docker compose up -d user-svc chat-svc
> ```

The message persistence worker and delivery worker are **embedded inside chat-svc** — no separate processes needed.

---

## Step 9: Verify Backend Health

```bash
# user-svc health check
curl http://localhost:4001/health

# chat-svc health check
curl http://localhost:4002/health
```

Both should return `{ "success": true, "status": "healthy" }`.

---

## Step 10: Start Local Backend Services

Open **2 separate terminal tabs:**

### Terminal 1: forum-svc (Forums & Community)
```bash
cd services/forum-svc
npm run dev
```
**Expected:** `🚀 forum-svc running on http://localhost:4003`

### Terminal 2: Notification Worker
```bash
cd services/notif-svc
npm run dev
```
**Expected:** `notif-svc consumer started`

---

## Step 11: Start the Mobile App

```bash
cd apps/mobile
npx expo start
```

Then:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go on your physical device

---

## Step 12: Start the Web App (Desktop Experience)

```bash
cd apps/web
npm run dev
```
**Expected:** `➜  Local:   http://localhost:3000/`

---

## Step 13: Start the Admin Panel

```bash
cd apps/admin
npm run dev -- -p 3001
```
**Expected:** `▲ Next.js ready on http://localhost:3001`

> [!NOTE]
> Admin runs on port **3001** to avoid conflict with the web app on port 3000.

---

## Full Stack Test Checklist

### 1. Register a New Account
1. Open the app → Sign Up tab
2. Enter name, email, password
3. You'll be redirected to the OTP screen
4. Check your email (or the user-svc logs for the OTP in dev mode: `docker logs digiability_user_svc`)
5. Enter the 6-digit OTP → Email verified! ✅

### 2. Login with the Bot Account
1. Open a second device/emulator
2. Login with: `bot@digiability.com` / `DigiBot@2024`
3. The bot account is pre-verified ✅

### 3. Test Messaging
1. On your first account, go to conversations
2. The Digiability Bot should appear in your conversation list
3. Send a message to the bot
4. On the second device (logged in as bot), you should see the message
5. Reply from the bot account → verify it appears on the first device

### 4. Test Self-Messaging
1. Create a new conversation with yourself
2. Send messages to yourself
3. Verify they appear immediately

### 5. Multi-Device Sync
1. Login to the same account on two devices
2. Send a message from Device A
3. Verify it appears on Device B in real-time

### 6. Test Care Circles & Groups
1. Open the app on the first device.
2. Tap the pencil icon in the header to create a new group.
3. Choose "Care Circle" or "General Group".
4. Search for another user (like the Bot) and select them. Give them a role (for Care Circles).
5. Create the group. This sends an invite.
6. Log in as the invited user on a second device.
7. Go to Invites (envelope icon in the header), and accept the pending invite.
8. Verify you can now see the group on both devices and chat in it.
9. Verify the Group Info screen permissions by tapping the header in the group chat.

### 7. Test Forgot Password
1. On the login screen, tap **Forgot Password**.
2. Enter your registered email address.
3. Check your email (or `docker logs digiability_user_svc` in dev mode) for the OTP.
4. Enter the OTP and set a new password.
5. Log in with the new password → should succeed ✅

### 8. Browse Mentors
1. Navigate to **Community → Mentors tab**.
2. Verify mentor cards load with profile info and areas of expertise.
3. Tap a mentor card to view their full profile.

### 9. Access Admin Panel
1. Open `http://localhost:3001` in a browser.
2. Log in with an admin account.
3. Verify these pages load with real data: **Dashboard, Users, Groups, Forums, Events, Moderation, Notifications, Settings**.
4. Try viewing a user detail page and modifying their status.

---

## Shutdown Procedure

```bash
# Stop all Docker containers (keeps data volumes)
docker compose down

# To also remove all data volumes (WARNING: deletes all data!):
docker compose down -v
```

---

## Rebuilding After Code Changes

When you change code in **user-svc** or **chat-svc**, rebuild their Docker images:

```bash
docker compose up -d --build user-svc chat-svc
```

For **forum-svc** or **notif-svc**, just restart the local `npm run dev` process.

---

## Troubleshooting

### ❌ "Cannot connect to database"
```bash
# Check if PostgreSQL is running
docker compose ps postgres
# If not running:
docker compose up -d postgres
# Wait for healthy, then try again
```

### ❌ "ECONNREFUSED" on Redis
```bash
docker compose ps redis
docker compose up -d redis
```

### ❌ "OTP not received"
- In development, OTP is logged inside the **user-svc container**
- Check with: `docker logs digiability_user_svc`
- Look for: `[EmailService / DEV] Verification OTP for <email>: <otp>`
- If using real email, check spam/junk folder

### ❌ "WebSocket won't connect"
- Ensure chat-svc is running: `curl http://localhost:4002/health`
- Check that the mobile app's API URL points to `http://<your-ip>:4001` (user-svc) and `ws://<your-ip>:4002/ws` (chat-svc)
- On physical devices, use your machine's local IP (not `localhost`)

### ❌ "Prisma schema drift"
```bash
# Re-sync the database schema
cd services/<service-name>
npx prisma db push --force-reset  # WARNING: drops all data
npx prisma generate
```

### ❌ user-svc or chat-svc container won't start
```bash
# Check container logs
docker logs digiability_user_svc
docker logs digiability_chat_svc

# Rebuild from scratch
docker compose up -d --build user-svc chat-svc
```

### ❌ Port 4001 or 4002 already in use
You may have a stale local `npm run dev` process from a previous session. Kill it:
```bash
lsof -ti:4001 | xargs kill -9
lsof -ti:4002 | xargs kill -9
```
Then restart the Docker containers.

---

## Architecture Quick Reference

```
┌───────────────────────────────────────────────────────────────┐
│                        Docker Compose                         │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  ┌───────┐  │
│  │  user-svc   │  │  chat-svc   │  │ postgres │  │ redis │  │
│  │   :4001     │  │   :4002     │  │  :5432   │  │ :6379 │  │
│  │ Auth/Users  │  │ Chat/WS +   │  │          │  │       │  │
│  │             │  │ Workers     │  │          │  │       │  │
│  └─────────────┘  └─────────────┘  └──────────┘  └───────┘  │
└───────────────────────────────────────────────────────────────┘

         Local processes (npm run dev)
  ┌──────────────┐  ┌──────────────┐
  │  forum-svc   │  │  notif-svc   │
  │    :4003     │  │   (worker)   │
  └──────────────┘  └──────────────┘

         Frontend apps (local)
  ┌───────────┐  ┌───────────┐  ┌─────────────┐
  │  Mobile   │  │  Web App  │  │ Admin Panel │
  │  (Expo)   │  │   :3000   │  │    :3001    │
  └───────────┘  └───────────┘  └─────────────┘
```

| Service | Port | Runs in | Purpose |
|---------|------|---------|---------|
| user-svc | 4001 | Docker | Auth, users, profiles, OTP verification |
| chat-svc | 4002 | Docker | Chat REST API + WebSocket + embedded workers |
| forum-svc | 4003 | Local | Forums, posts, community discussions |
| notif-svc | — | Local | Notification worker (Redis stream consumer) |
| PostgreSQL | 5432 | Docker | All persistent data (users, chat, groups, forums) |
| Redis | 6379 | Docker | Message streams, Pub/Sub, presence registry |
| Web App | 3000 | Local | Desktop web experience (Vite + React) |
| Admin Panel | 3001 | Local | Admin dashboard (Next.js) |
| pgAdmin | 5050 | Docker (dev profile) | PostgreSQL web UI |
