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

Three variables, one per service. They are **build-time** — Expo inlines any `EXPO_PUBLIC_*` value into the bundle, so changing a URL requires restarting `expo start` (dev) or making a new build (EAS).

| Variable | Service | Used by |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | user-svc | `apiClient.ts` (auth, profiles, events, push registration) |
| `EXPO_PUBLIC_CHAT_API_URL` | chat-svc | `chatService.ts` REST **and** `socketService.ts` WebSocket |
| `EXPO_PUBLIC_FORUM_API_URL` | forum-svc | `forumService.ts` REST **and** `forumSocketService.ts` Socket.io |

If the chat/forum variables are omitted they fall back to deriving from the API base by replacing port `4001` → `4002`/`4003`. **That fallback only works for local dev on the default ports** — it is a literal string replace, so it silently no-ops on any host whose URL doesn't contain `4001` (every real deployment). Always set all three explicitly outside local dev.

The chat WebSocket URL is derived from `EXPO_PUBLIC_CHAT_API_URL` by swapping the scheme (`http`→`ws`, `https`→`wss`) and appending `/ws`; it needs no separate variable.

### Choosing a host

| Target | Host to use |
|---|---|
| Android emulator | `10.0.2.2` (maps to your machine's localhost) |
| iOS simulator | `localhost` |
| Physical device | your machine's LAN IP — `ipconfig getifaddr en0` (macOS) |
| Live servers | the deployed host/ports |

`localhost` will **not** resolve from a physical device — it points at the phone itself.

---

## Store Builds (EAS)

`.env` is **not** read by EAS. Each profile in [`eas.json`](./eas.json) carries its own `env` block — update the URLs there when they change.

| Profile | Purpose | Backend |
|---|---|---|
| `development` | dev client | local (`10.0.2.2`) |
| `preview` | internal distribution | live servers |
| `production` | store submission | live servers |

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
- **Privacy policy URL.** `EXPO_PUBLIC_WEB_BASE_URL` still defaults to `http://localhost:3000`, so the Welcome screen's Terms/Privacy links are dead. Both stores require a reachable privacy policy to approve a build.
- **Cleartext HTTP.** Both stores block plain `http://` by default. `app.json` currently opts in via `NSAllowsArbitraryLoads` (iOS ATS) and `usesCleartextTraffic` (Android, through `expo-build-properties`) because the backend is served over `http://` on a bare IP. **Apple review may reject or question this** — the durable fix is a domain with TLS in front of the backend, after which both exemptions should be removed.
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
