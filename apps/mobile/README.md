# mobile — Digiability Community App

The primary client. **Expo 54 + React Native 0.81 + TypeScript**, with Zustand for state and React Navigation for routing. Ships to the App Store and Play Store via **EAS**.

---

## Quick Start

```bash
# From the monorepo root
npm install

cp .env.example .env
# Point the three service URLs at your backend (see below)

cd apps/mobile
npx expo start        # a = Android, i = iOS, w = web
```

Typecheck: `npx tsc --noEmit`

---

## Backend URLs

Six variables, all **required** and read in one place: [`src/config/env.ts`](./src/config/env.ts). They are **build-time** — Expo inlines any `EXPO_PUBLIC_*` value into the bundle, so changing a URL requires restarting `expo start` (dev) or making a new build (EAS).

| Variable | Service | Used by |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | user-svc | `apiClient.ts`, `systemStore.ts` |
| `EXPO_PUBLIC_CHAT_API_URL` | chat-svc REST | `chatService.ts`, `MediaViewer.tsx` |
| `EXPO_PUBLIC_CHAT_SOCKET_URL` | chat-svc WebSocket (`…/ws`) | `socketService.ts` |
| `EXPO_PUBLIC_FORUM_API_URL` | forum-svc REST | `forumService.ts` |
| `EXPO_PUBLIC_FORUM_SOCKET_URL` | forum-svc Socket.io | `forumSocketService.ts` |
| `EXPO_PUBLIC_ADMIN_API_URL` | admin panel API | `systemStore.ts`, `serviceService.ts` |

There are no fallbacks: a missing variable throws at startup naming the variable. In a `production` build (`extra.buildProfile`, set by `app.config.js`), any URL that isn't `https://` — or socket URL that isn't `wss://` — also throws at startup.

### Choosing a host

| Target | Host to use |
|---|---|
| Android emulator | `10.0.2.2` (maps to your machine's localhost) |
| iOS simulator | `localhost` |
| Physical device | your machine's LAN IP — `ipconfig getifaddr en0` (macOS) |
| Live servers | `https://{api,chat,forum,admin}.community.digiability.in` |

`localhost` will **not** resolve from a physical device — it points at the phone itself.

---

## Store Builds (EAS)

`.env` is **not** read by EAS. Each profile in [`eas.json`](./eas.json) carries its own `env` block — update the URLs there when they change.

| Profile | Purpose | Backend |
|---|---|---|
| `development` | dev client | your local `.env` (no URLs in `eas.json`) |
| `preview` | internal distribution | live servers (https/wss) — cleartext still allowed by `app.config.js` |
| `production` | store submission / release APK | live servers (https/wss), cleartext denied, ATS enforced |

```bash
npm install -g eas-cli
eas login
eas init                                    # links the project, writes extra.eas.projectId

eas build --platform android --profile production
eas build --platform ios     --profile production

eas submit --platform android --profile production
eas submit --platform ios     --profile production
```

### Before a store build — known blockers

- **`google-services.json` is missing.** [`app.json`](./app.json) references `android.googleServicesFile`, so the **Android build will fail** until you download it from the Firebase console into `apps/mobile/`. Required for Android push.
- **Privacy policy URL.** Terms/Privacy open in-app; the stores still need a public privacy policy URL in the listing.
- **Cleartext HTTP.** Production builds deny cleartext and enforce ATS (`app.config.js`); `npm run check:transport` (repo root) fails if that regresses. They need the HTTPS hosts to be live — see `DEVOPS_TASKS.txt` at the repo root.
- **Version bumps.** `app.json` sets `android.versionCode` and `ios.buildNumber`; both must increment on every store submission.

---

## Path Aliases

Defined in **both** `tsconfig.json` and `babel.config.js` — adding one to only a single file breaks either typecheck or runtime.

| Alias | Resolves to |
|---|---|
| `@store/*` | `src/store/*` |
| `@services/*` | `src/services/*` |
| `@screens/*` | `src/screens/*` |
| `@navigation/*` | `src/navigation/*` |
| `@components/*` | `src/components/*` |
| `@hooks/*` | `src/hooks/*` |
| `@assets/*` | `assets/*` |

---

## Navigation

```
RootNavigator
  ├── AuthNavigator   (Splash, Welcome, Login/Register, VerifyEmail,
  │                    ForgotPassword, RoleSelection, Accessibility)
  └── MainNavigator
        ├── MainTabs  (Home, Community, Services, Learn, Profile)
        │     └── CommunityScreen → Chats · Groups · Care Circles · Forums · Mentors
        └── Chats     (ChatsStack — pushed over the tabs)
              ConversationList · Chat · GroupChat · CreateGroup ·
              GroupInfo · Invites · UserProfile
```

**Gotcha:** ChatsStack is registered as `"Chats"` on MainNavigator, so navigate into it from a tab with nested params:

```typescript
navigation.navigate("Chats", {
  screen: "GroupChat",
  params: { conversationId, groupName, subType },
} as any);
```

---

## State (Zustand)

| Store | File | Holds |
|---|---|---|
| `useAuthStore` | `src/store/authStore.ts` | tokens, user, onboarding state |
| `useChatStore` | `src/store/chatStore.ts` | conversations, messages, presence, invites |
| `useForumStore` | `src/store/forumStore.ts` | forum posts |
| `useGroupStore` | `src/store/groupStore.ts` | group state |
| `useAccessibilityStore` | `src/store/accessibilityStore.ts` | a11y prefs (persisted per userId) |
| `usePresenceStore` | `src/store/presenceStore.ts` | online/offline presence |

**Tokens:** the access token lives in Zustand (memory only); the refresh token is persisted in `expo-secure-store` under `digiability_refresh_token`. On boot, `RootNavigator` reads it, silently calls `getMe()`, and repopulates the auth store.

The refresh token is **not** in the login response body — read it from the `x-refresh-token` response header (native clients can't rely on cookies).

---

## Push Notifications

Registered through **user-svc**, not notif-svc:

```
POST   /api/auth/device-token   { token, platform }   — on login
DELETE /api/auth/device-token                          — on logout
```

The Expo push token needs `extra.eas.projectId`, which `eas init` writes. Push only works on a **physical device** — never in a simulator.

---

## Related Docs

| Doc | Path |
|-----|------|
| Monorepo overview | [`README.md`](../../README.md) |
| Environment Guide | [`docs/env-guide.md`](../../docs/env-guide.md) |
| API Reference | [`docs/api-reference.md`](../../docs/api-reference.md) |
| WebSocket Events | [`docs/websocket-events.md`](../../docs/websocket-events.md) |
