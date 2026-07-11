# Digiability Community — Session Handoff / Context Primer

Paste this into a new chat so it has full context without re-deriving it. The
repo has a detailed `CLAUDE.md` (architecture) — read that first for the base
system. This file captures **what changed in the recent work session** and the
**current state**.

---

## 1. System recap (see CLAUDE.md for full detail)
Turborepo monorepo. Backends: `user-svc` (:4001, auth/JWT RS256, Docker),
`chat-svc` (:4002, REST + WebSocket + embedded workers, Prisma `chat` schema,
Docker), `forum-svc` (:4003, Socket.io, local — **no Dockerfile**), `notif-svc`
(:4004, Redis→Expo Push, Docker). Infra: Postgres 16 (one DB `digiability_db`,
schemas `public`/`chat`/`forum`) + Redis 7. Clients: `apps/web` (Vite/React),
`apps/admin` (Next.js 15 :3001), `apps/mobile` (Expo RN). Message pipeline runs
over Redis Streams and **already carries `type` + `metadata` end-to-end**.

---

## 2. What was built/fixed this session

### Chat features (mobile + web + chat-svc)
- **Voice messages** — record (`expo-av`) / MediaRecorder → upload → AUDIO msg → playback.
- **Image sharing + alt-text** — pick (`expo-image-picker`) / file input → alt-text modal → IMAGE msg (a11y label).
- **TTS read-aloud** — long-press (mobile `expo-speech`) / right-click (web `speechSynthesis`).
- **SOS button** — Care-Circle chat header; posts an emergency + location message; **reuses the message pipeline** (delivers + push, no new backend).
- **Typing indicators** — fixed: mobile listened for non-existent `typing.update`; backend actually broadcasts `typing.start.broadcast` / `typing.stop.broadcast`. Mobile+web now emit + render typing.
- **Presence** — header shows Online / last-seen. NOTE: backend **never broadcasts `presence.update` over WS**; clients fetch it via REST `GET /api/presence/:userId` on chat open + 30s poll. (Real-time flip would need a backend broadcast on connect/disconnect.)
- **Block / report** — NEW Prisma models `BlockedUser` (`blocked_users`) + `Report` (`reports`) in chat schema; `/api/moderation/*` routes; **DM send handler rejects if either party blocked**. UI: DM header ⋮ + message context menu.
- **Join-request approval UI** — backend already existed (`approveJoinRequest`, `AWAITING_APPROVAL`); added "Pending Requests" section in GroupInfo (mobile+web).
- **Group lifecycle** (earlier) — delete group (owner, `DELETE /api/conversations/:id` + `group.deleted` WS event), edit name/desc, mute, member add/remove.
- **Message delete** — me/everyone + admin force-delete in groups.
- **Media URL fix** — upload endpoint now returns a **host-relative path** (`/uploads/x.jpg`); each client resolves against its own base via `resolveMediaUrl()`. (Fixes "works on mobile not web" — the old absolute URL baked the uploader's host like `10.0.2.2`.)

### Mobile UX
- **New composer / typing bar** — white rounded card, purple `+` (image), pill input, **orange mic** button, **purple send** button (two separate buttons). Identical in ChatScreen (DMs) and GroupChatScreen (groups + care circles).
- **Stylish modals** — `ActionSheet` (bottom sheet) + `ConfirmDialog` (centered) replace native `Alert`/`ActionSheetIOS` for report/block/delete. Backdrop-dismiss + Cancel + on-brand purple.
- **Unread badges** — chat screens now `clearUnreadCount` + send `message.read` on open; list header shows "N unread **chats**" (not message count); Community tab bar shows per-section unread count badges (Chats/Groups/Care Circles). Pending invites are NOT counted in the badge (was inflating Groups to 1).

### Admin panel (Next.js)
- **Auth is fine** — earlier "16 unauthenticated routes" claim was a FALSE ALARM (grep missed `requireAdminAuth`). All 16 data routes call it; only login/logout are open. Middleware guards pages (excludes /api by design; each route self-guards).
- **Warn/Ban wired** — were dead buttons targeting the reporter (not the offender). Now: GET returns the reported content's **author**; POST supports `warn` (notify + optional suspend) and `ban` (suspend). Operates on author's userId.
- **Chat/DM reports surfaced** — moderation GET now merges `chat.reports` with `forum_reports` (guarded; source-tagged); actions `dismiss_chat` + ban work cross-source.
- **Audit log reliable** — `lib/audit.ts` auto-creates `admin_audit_log` and writes on suspend/ban/warn/dismiss/delete_post/delete_user (was write-only + swallowed errors).

---

## 3. New files created this session
**mobile** (`apps/mobile/src/`): `hooks/useChatMedia.ts`, `components/chat/MessageMedia.tsx`, `components/chat/AltTextModal.tsx`, `components/chat/ActionSheet.tsx`, `components/chat/ConfirmDialog.tsx`
**web** (`apps/web/src/`): `features/chats/MessageMedia.tsx`
**chat-svc** (`services/chat-svc/src/`): `middleware/upload.middleware.ts`, `controllers/media.controller.ts`, `routes/media.routes.ts`, `repositories/moderation.repository.ts`, `controllers/moderation.controller.ts`, `routes/moderation.routes.ts`
**admin** (`apps/admin/`): `lib/audit.ts`
**root**: `Digiability_Deployment_Strategy.pdf` (deployment plan, sized for 1k–5k users)

Key modified: chat-svc `index.ts` (media + moderation routes, static `/uploads`), `websocket/handlers/message.handler.ts` (block gate), `prisma/schema.prisma` (BlockedUser + Report). Both clients' `chatService.ts` (uploadMedia, moderation, getGroupInvites, getPresence, `resolveMediaUrl`, exported `CHAT_BASE_URL`), `socketService.ts`, `chatStore.ts`, chat screens, GroupInfo panels. Admin `api/moderation/route.ts`, `api/users/[id]/route.ts`, `(dashboard)/moderation/page.tsx`.

---

## 4. To run locally (IMPORTANT — required setup)
```bash
docker compose up -d postgres redis
cd services/user-svc  && npx prisma db push   # (already done — fixed deletedAt drift)
cd services/chat-svc  && npx prisma db push   # creates blocked_users + reports
cd services/forum-svc && npx prisma db push
cd <root> && docker compose up -d --build user-svc chat-svc notif-svc
# local: forum-svc (npm run dev), apps/web (npm run dev), apps/admin (npm run dev), apps/mobile (npx expo start -c)
cd services/user-svc && npm run db:seed-bot   # DigiBot (done)
```
- **Media works locally with NO S3/CDN** — multer writes to `services/chat-svc/uploads` (local disk, ephemeral across rebuilds), served at `/uploads`. S3/CDN only needed for multi-node/prod.
- **Mobile physical device**: `EXPO_PUBLIC_API_BASE_URL` must be the **LAN IP**, not localhost.
- **After mobile JS edits**: reload Metro; use `npx expo start -c` to clear a stale bundle (the composer/typing-bar is identical across DM+group screens — a "difference" is a stale bundle).
- Admin `admin_audit_log` auto-creates; `chat.reports` read is guarded (safe before migration).

---

## 5. Known limitations / pending decisions
- **Presence** is poll-based (30s), not real-time push (backend doesn't emit `presence.update` WS). Would need a chat-svc broadcast on connect/disconnect.
- **Forums/Mentors** community tab badges are always 0 (no unread source wired).
- **Web block/report** still uses browser `window.confirm`/`window.prompt` (unstyled) — mobile got custom modals, web didn't.
- **Caregiver-managed accounts** — intentionally NOT built; needs a product/security model decision (recommended: linked/guardian accounts). See memory `caregiver-managed-accounts-decision`.
- **Old media messages** may have absolute URLs baked with the old host and can be broken cross-client; only NEW uploads use portable relative paths.
- **Media at scale** → move `media.controller.ts` (and forum upload controller) to S3/R2.
- **forum-svc has no Dockerfile**; `docker/postgres/init.sql` creates stray unused DBs (services use schemas).

---

## 6. Conventions / gotchas
- chat-svc: repository layer is the only Prisma caller; generated client in `src/generated/client` (run `npx prisma generate` after schema edits — done for BlockedUser/Report).
- WS events live in `services/chat-svc/src/types/ws-events.ts`. Typing = `typing.start.broadcast`/`typing.stop.broadcast`.
- Mobile path aliases: `@store @services @hooks @screens @navigation @components @assets` (defined in tsconfig + babel.config.js).
- Admin API routes rely on DB `search_path` spanning `public,chat,forum`; `chat.reports` is schema-qualified in queries.
- Group vs Care Circle: both `type: GROUP`, `subType GENERAL|CARE_CIRCLE`; admin roles differ (`hasAdminAccess`). Both use mobile `GroupChatScreen`.
- Typecheck: `cd <svc/app> && npx tsc --noEmit`. Mobile has pre-existing unrelated `notificationService`/`expo-notifications` type noise — filter it.
- **NEVER commit `.env`** (real credentials); they're gitignored.
- Nothing from this session is committed to git yet.

---

## 7. Persistent memory files (auto-loaded)
`~/.claude/projects/-Users-addy-Downloads-Digiability-Community/memory/`:
`pwd-features-migration-steps.md`, `caregiver-managed-accounts-decision.md`.
