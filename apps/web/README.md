# web — Digiability Community (Browser Client)

Browser client built with **Vite 8 + React 19 + TypeScript + React Router 6**. Runs on **port 3000**, deployed to Vercel. Linted with **oxlint** (not ESLint).

---

## Quick Start

```bash
# From the monorepo root
npm install

cp .env.example .env.local
# Point VITE_* at your backend services

cd apps/web
npm run dev        # → http://localhost:3000
```

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server on :3000 |
| `npm run build` | `tsc -b` then `vite build` → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | oxlint |

---

## Environment

| Variable | Service |
|---|---|
| `VITE_USER_SVC_URL` | user-svc (auth, profiles, events) |
| `VITE_CHAT_SVC_URL` | chat-svc (REST **and** WebSocket) |
| `VITE_FORUM_SVC_URL` | forum-svc |

These are **build-time** — Vite inlines them into the bundle, so they are not runtime configuration. Changing a backend URL requires a rebuild and redeploy.

- `.env.local` — local dev (gitignored; copy from `.env.example`)
- `.env.production` — read by `vite build`; **gitignored**, so create it locally when you need a production bundle built on your machine

Because both are gitignored, **CI/Vercel builds get their values from Project → Environment Variables**, not from a file in the repo. Set `VITE_USER_SVC_URL`, `VITE_CHAT_SVC_URL`, and `VITE_FORUM_SVC_URL` there or the build silently falls back to the `localhost` defaults baked into the source.

The chat WebSocket URL is derived from `VITE_CHAT_SVC_URL` by swapping the scheme (`http`→`ws`, `https`→`wss`), so it needs no separate variable.

### Two gotchas when pointing at a live backend

1. **CORS is single-origin.** user-svc (when `NODE_ENV=production`) and chat-svc (always) allow exactly **one** origin — their `CLIENT_BASE_URL`. It must exactly match the origin this app is served from, or every request is blocked.
2. **The refresh cookie needs HTTPS.** With `NODE_ENV=production` the refresh cookie is set `Secure`, so browsers drop it over plain `http://` and the session silently fails to restore. Serve the backend over HTTPS.

---

## Routes

| Path | Layout / View |
|---|---|
| `/` | redirect → `/app/chats` or `/login` |
| `/login`, `/register`, `/verify-email` | `AuthLayout` |
| `/onboarding/accessibility`, `/onboarding/role`, `/onboarding/profile` | `OnboardingLayout` |
| `/app/chats/:conversationId` | `ChatsLayout` + `ChatView` (DMs) |
| `/app/groups/:conversationId` | `ChatsLayout` + `ChatView` (General Groups) |
| `/app/care-circles/:conversationId` | `ChatsLayout` + `ChatView` (Care Circles) |
| `/app/mentors`, `/app/forums`, `/app/events`, `/app/services`, `/app/learn` | feature pages |

`ChatsLayout` infers the conversation type from the `location.pathname` prefix — DMs, Groups, and Care Circles all render through the same `ChatView`.

---

## Auth & Token Handling

`src/services/apiClient.ts` is an Axios instance with:

- a **request** interceptor that attaches `Authorization: Bearer <accessToken>`
- a **response** interceptor that catches 401, calls `/api/auth/refresh`, queues concurrent requests during the refresh, and retries them all on success — clearing auth state and `localStorage` if the refresh fails

The access token is held in Zustand (memory). The refresh token is stored in `localStorage` under `digiability_refresh_token` and also set as an HTTP-only cookie; it is read from the `x-refresh-token` response header or the cookie.

> Note: forum realtime (Socket.io) is **not** wired up on web — it exists only on mobile.

---

## Related Docs

| Doc | Path |
|-----|------|
| Monorepo overview | [`README.md`](../../README.md) |
| Environment Guide | [`docs/env-guide.md`](../../docs/env-guide.md) |
| API Reference | [`docs/api-reference.md`](../../docs/api-reference.md) |
