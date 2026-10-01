import Constants from 'expo-constants';

// ─────────────────────────────────────────────────────────
// Backend endpoints — the only place the app reads them.
//
// Every value comes from an EXPO_PUBLIC_* variable, set per build profile in
// eas.json (EAS builds) or in apps/mobile/.env (`expo start`). There are no
// fallbacks: a guessed default is how builds previously ended up talking
// cleartext HTTP to a raw IP. A missing variable fails loudly at startup.
//
// Each `process.env.EXPO_PUBLIC_X` must stay a literal property access —
// Expo inlines them at bundle time and cannot resolve dynamic lookups.
// ─────────────────────────────────────────────────────────

const raw = {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_CHAT_API_URL: process.env.EXPO_PUBLIC_CHAT_API_URL,
  EXPO_PUBLIC_CHAT_SOCKET_URL: process.env.EXPO_PUBLIC_CHAT_SOCKET_URL,
  EXPO_PUBLIC_FORUM_API_URL: process.env.EXPO_PUBLIC_FORUM_API_URL,
  EXPO_PUBLIC_FORUM_SOCKET_URL: process.env.EXPO_PUBLIC_FORUM_SOCKET_URL,
  EXPO_PUBLIC_ADMIN_API_URL: process.env.EXPO_PUBLIC_ADMIN_API_URL,
};

type EnvKey = keyof typeof raw;

function required(key: EnvKey): string {
  const value = raw[key]?.trim();
  if (!value) {
    throw new Error(
      `[config] ${key} is not set. Add it to apps/mobile/.env (local) or the build profile in eas.json.`
    );
  }
  return value.replace(/\/+$/, '');
}

export const API_URL = required('EXPO_PUBLIC_API_URL');
export const CHAT_API_URL = required('EXPO_PUBLIC_CHAT_API_URL');
export const CHAT_SOCKET_URL = required('EXPO_PUBLIC_CHAT_SOCKET_URL');
export const FORUM_API_URL = required('EXPO_PUBLIC_FORUM_API_URL');
export const FORUM_SOCKET_URL = required('EXPO_PUBLIC_FORUM_SOCKET_URL');
export const ADMIN_API_URL = required('EXPO_PUBLIC_ADMIN_API_URL');

// Set by app.config.js from EAS_BUILD_PROFILE; "development" for `expo start`.
export const BUILD_PROFILE: string =
  (Constants.expoConfig?.extra?.buildProfile as string | undefined) ?? 'development';

// Production builds must never talk cleartext. ATS / usesCleartextTraffic
// already block it at the OS layer; this makes a misconfigured build crash at
// launch with a clear message instead of failing request-by-request.
if (BUILD_PROFILE === 'production') {
  const insecure = [
    ['EXPO_PUBLIC_API_URL', API_URL, 'https://'],
    ['EXPO_PUBLIC_CHAT_API_URL', CHAT_API_URL, 'https://'],
    ['EXPO_PUBLIC_FORUM_API_URL', FORUM_API_URL, 'https://'],
    ['EXPO_PUBLIC_ADMIN_API_URL', ADMIN_API_URL, 'https://'],
    ['EXPO_PUBLIC_CHAT_SOCKET_URL', CHAT_SOCKET_URL, 'wss://'],
    ['EXPO_PUBLIC_FORUM_SOCKET_URL', FORUM_SOCKET_URL, 'wss://'],
  ].filter(([, value, scheme]) => !value.startsWith(scheme));

  if (insecure.length > 0) {
    throw new Error(
      '[config] Production build has insecure endpoints: ' +
        insecure.map(([key, value, scheme]) => `${key}=${value} (must be ${scheme})`).join('; ')
    );
  }
}
