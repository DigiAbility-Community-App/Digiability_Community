# admin — Digiability Community Admin Panel

Community management dashboard built with **Next.js 15 (App Router) + React + TailwindCSS**. Runs on **port 3001**, deployed to Vercel.

---

## Quick Start

```bash
# From the monorepo root
npm install

cp .env.example .env.local
# Fill in DATABASE_URL, JWT_SECRET, and the service URLs

cd apps/admin
npm run dev        # → http://localhost:3001
```

| Script | Does |
|---|---|
| `npm run dev` | Next dev server on :3001 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build on :3001 |
| `npm run lint` | next lint |

---

## Pages

```
app/
├── (auth)/login              ← admin login
└── (dashboard)/
    ├── dashboard             ← overview
    ├── users  · users/[id]   ← user management, verify/suspend
    ├── groups · groups/[id]  ← groups & members
    ├── forums                ← forum content
    ├── events                ← events
    ├── messages              ← messages
    ├── analytics             ← usage analytics
    ├── notifications         ← broadcast notifications
    ├── moderation            ← + appeals, audit-log, keyword-filters
    └── settings              ← disability types, notification settings
```

Moderation is scaffolded — backend enforcement is still in progress.

---

## Authentication

Admin auth is **entirely separate from user-svc's**:

- Credentials live in **`data/credentials.json`** (git-tracked, ships with the deployment) as an email → **bcrypt hash** map. The login route falls back to a hardcoded default map **only if that file is absent** — so the file always wins when present.
- On success it signs a **symmetric HS256** session JWT with `JWT_SECRET` (not user-svc's RS256 keys) and sets an `admin-session` cookie: `httpOnly`, `sameSite=strict`, `Secure` when `NODE_ENV=production`, 1-day expiry.
- `middleware.ts` gates the dashboard. If `JWT_SECRET` is unset it denies everything and redirects to `/login`. The matcher excludes `/api`, so each API route calls `requireAdminAuth()` itself.

> ⚠️ **Rotating the admin password means editing `data/credentials.json`** — changing only the fallback map in the login route has no effect while the file exists. Generate a hash with `bcrypt.hashSync(password, 10)` and redeploy.

> ⚠️ Over plain `http://` with `NODE_ENV=production`, the `Secure` session cookie is dropped by browsers and login silently fails. Serve the panel over HTTPS.

---

## Data Access — mostly direct SQL

Unlike the clients, admin talks to **PostgreSQL directly** for most reads and writes via a shared `pg` Pool (`lib/db.ts`), not through the backend services. Only a few routes proxy:

| Route(s) | Target | Header |
|---|---|---|
| `/api/moderation/*` (flags, keywords, audit, review) | `USER_SVC_URL` | `x-internal-secret` |
| `/api/groups/[id]` (DELETE) | `CHAT_SVC_URL` | `x-internal-secret` |

`/api/groups/[id]` **falls back to a direct DB write** if `CHAT_SVC_URL` or `INTERNAL_API_SECRET` is unset — set both together, or group deletion will bypass chat-svc.

Because admin writes to tables owned by user-svc and chat-svc with raw SQL, schema changes there will **not** surface as TypeScript errors here. Check this app whenever those schemas change.

---

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Direct PostgreSQL access (required — throws if missing) |
| `JWT_SECRET` | Signs the admin session cookie (symmetric, admin-only) |
| `INTERNAL_API_SECRET` | `x-internal-secret` when proxying to user-svc/chat-svc |
| `USER_SVC_URL` | Moderation proxy target |
| `CHAT_SVC_URL` | Group-deletion proxy target |
| `NEXT_PUBLIC_APP_URL` | Admin's own URL, used for the post-logout redirect |
| `FORUM_SVC_URL`, `NOTIF_SVC_URL` | Reserved — not referenced by admin code today |

`next.config.js` sets a CSP whose `connect-src` hardcodes `localhost:4001-4003`. Harmless today because admin's browser code only calls its own `/api` routes, but it must be updated if the frontend ever calls a backend service directly.

See [`.env.example`](./.env.example) and [`docs/env-guide.md`](../../docs/env-guide.md).

---

## Related Docs

| Doc | Path |
|-----|------|
| Monorepo overview | [`README.md`](../../README.md) |
| Environment Guide | [`docs/env-guide.md`](../../docs/env-guide.md) |
| API Reference | [`docs/api-reference.md`](../../docs/api-reference.md) |
