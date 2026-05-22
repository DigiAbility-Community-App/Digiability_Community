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
> Make sure Docker Desktop is **running** before you start. All infrastructure (PostgreSQL, Redis, Cassandra) runs in Docker containers.

---

## Step 1: Install Dependencies

From the **project root**:

```bash
# Install root workspace dependencies
npm install

# Install user-svc dependencies
cd services/user-svc && npm install && cd ../..

# Install chat-svc dependencies  
cd services/chat-svc && npm install && cd ../..

# Install mobile app dependencies
cd apps/mobile && npm install && cd ../..
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
- **chat-svc**: `DATABASE_URL`, `REDIS_URL`, `CASSANDRA_HOST`, `JWT_PUBLIC_KEY`

> [!TIP]
> If you need to change SMTP credentials, update `MAIL_USER` and `MAIL_PASS` in `services/user-svc/.env`.

---

## Step 3: Start Docker Infrastructure

```bash
# Start ALL infrastructure containers (PostgreSQL + Redis + Cassandra)
docker compose up -d postgres redis cassandra
```

### Wait for containers to be healthy:

```bash
# Check status (repeat until all show "healthy")
docker compose ps
```

**Expected output after ~60-90 seconds:**

| Container | Status |
|-----------|--------|
| `digiability_postgres` | healthy |
| `digiability_redis` | healthy |
| `digiability_cassandra` | healthy |

> [!WARNING]
> **Cassandra takes 60-90 seconds** to start. The healthcheck (`cqlsh -e 'describe cluster'`) will show `starting` until the node is fully initialized. Wait until it shows `healthy`.

You can also verify manually:
```bash
# Test PostgreSQL
docker exec digiability_postgres pg_isready

# Test Redis
docker exec digiability_redis redis-cli -a redis_secret PING

# Test Cassandra
docker exec digiability_cassandra cqlsh -e "DESCRIBE CLUSTER"
```

---

## Step 4: Initialize Cassandra Schema

Cassandra doesn't auto-initialize like PostgreSQL. You need to run the CQL init script manually:

```bash
docker exec -i digiability_cassandra cqlsh < docker/cassandra/init.cql
```

**Verify it worked:**
```bash
docker exec digiability_cassandra cqlsh -e "USE digiability_chat; DESCRIBE TABLES;"
```

Expected output:
```
messages  messages_by_client_id  conversation_sequence
```

---

## Step 5: Setup user-svc Database (Prisma)

```bash
cd services/user-svc

# Generate the Prisma client
npx prisma generate

# Push schema to PostgreSQL (creates tables)
npx prisma db push

# Verify tables exist (optional)
npx prisma studio
```

> [!NOTE]
> `prisma db push` is used instead of `prisma migrate dev` for initial setup. It creates all tables without generating migration files. For production, use `prisma migrate dev` to create tracked migrations.

---

## Step 6: Setup chat-svc Database (Prisma)

```bash
cd services/chat-svc

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

## Step 8: Start the Backend Services

Open **4 separate terminal tabs** and run each service:

### Terminal 1: user-svc (Auth & Users)
```bash
cd services/user-svc
npm run dev
```
**Expected:** `🚀 user-svc running on http://localhost:4001`

### Terminal 2: chat-svc (Chat API + WebSocket)
```bash
cd services/chat-svc
npm run dev
```
**Expected:** `🚀 chat-svc running on http://localhost:4002`

### Terminal 3: Message Persistence Worker
```bash
cd services/chat-svc
npm run worker:msg
```
**Expected:** `msg-svc consumer started`

### Terminal 4: Delivery Worker
```bash
cd services/chat-svc
npm run worker:delivery
```
**Expected:** `delivery worker started`

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

## Step 10: Start the Mobile App

```bash
cd apps/mobile
npx expo start
```

Then:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go on your physical device

---

## Full Stack Test Checklist

### 1. Register a New Account
1. Open the app → Sign Up tab
2. Enter name, email, password
3. You'll be redirected to the OTP screen
4. Check your email (or the user-svc terminal console for the OTP in dev mode)
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

---

## Shutdown Procedure

```bash
# Stop all Docker containers
docker compose down

# To also remove all data volumes (WARNING: deletes all data!):
docker compose down -v
```

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

### ❌ "Cassandra connection refused"
```bash
# Cassandra takes 60-90s to start
docker compose ps cassandra
# If still "starting", wait longer
# If exited, check logs:
docker compose logs cassandra
```

### ❌ "ECONNREFUSED" on Redis
```bash
docker compose ps redis
docker compose up -d redis
```

### ❌ "OTP not received"
- In development, OTP is logged to the **user-svc terminal console**
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

### ❌ "cassandra-driver not found"
```bash
cd services/chat-svc
npm install
```

---

## Architecture Quick Reference

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Mobile App  │    │   user-svc   │    │   chat-svc   │
│  (Expo/RN)   │───▶│  :4001       │    │  :4002       │
│              │    │  Auth/Users  │    │  Chat/WS     │
└──────┬───────┘    └──────────────┘    └───────┬──────┘
       │                                        │
       │              WebSocket                 │
       └────────────────────────────────────────┘
                                                │
       ┌───────────┐  ┌───────────┐  ┌──────────┴───┐
       │ PostgreSQL │  │   Redis   │  │  Cassandra   │
       │  :5432     │  │  :6379    │  │  :9042       │
       │  Users +   │  │  Streams  │  │  Messages    │
       │  Delivery  │  │  Pub/Sub  │  │              │
       └───────────┘  └───────────┘  └──────────────┘
```

| Service | Port | Purpose |
|---------|------|---------|
| user-svc | 4001 | Auth, users, profiles, OTP verification |
| chat-svc | 4002 | Chat REST API + WebSocket gateway |
| msg-svc worker | — | Persists messages from Redis stream to Cassandra |
| delivery worker | — | Routes delivered messages to recipient WebSockets |
| PostgreSQL | 5432 | Users, conversations, delivery state |
| Redis | 6379 | Message streams, Pub/Sub, presence registry |
| Cassandra | 9042 | Message content storage (write-optimized) |
