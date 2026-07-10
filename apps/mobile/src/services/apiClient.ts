import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@store/authStore';

// ─────────────────────────────────────────────────────────
// API Client
// Central Axios instance for all user-svc requests.
//
// Auth pattern:
//   • Access token  → in-memory (Zustand). Sent as Bearer header.
//   • Refresh token → stored in SecureStore (replaces HttpOnly cookie
//     which is not accessible in React Native without a custom native
//     module). On every /refresh call we read it from SecureStore and
//     send it as Authorization: Bearer — the server validates the
//     raw token hash. On success we store the new refresh token back.
//
//   NOTE: On web (expo-web) the browser handles HttpOnly cookies
//   automatically. On native we manage the refresh token ourselves.
// ─────────────────────────────────────────────────────────

// Use env or fall back to Android emulator localhost alias
const BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ??
  'http://10.0.2.2:4001';

export const REFRESH_TOKEN_KEY = 'digiability_refresh_token';

async function persistRefreshToken(
  headers: Record<string, string | string[] | undefined>
) {
  const headerToken = headers['x-refresh-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, headerToken);
    return;
  }

  const setCookie = headers['set-cookie'];
  if (!setCookie) return;

  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match =
    cookieStr.match(/refreshToken=([^;]+)/) ??
    cookieStr.match(/refresh_token=([^;]+)/);

  if (match?.[1]) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, match[1]);
  }
}

// ── Axios instance ─────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // required for web; no-op on native
});

// ── Request interceptor: attach access token ───────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: silent token refresh on 401 ─────
let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  pendingQueue = [];
}

// Call this on logout to reject any in-flight queued requests immediately
export function cancelPendingRequests() {
  processQueue(new Error('Session ended'), null);
  isRefreshing = false;
}

interface BanResponseBody {
  banned?: boolean;
  permanent?: boolean;
  suspendedUntil?: string | null;
  reason?: string | null;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // A banned/suspended account gets a 403 with `banned: true` from every
    // service's auth check (user-svc, chat-svc, forum-svc). Force logout and
    // stash the ban info so the auth stack can show the suspended screen —
    // this catches a ban that lands mid-session, not just at login.
    const body = error.response?.data as BanResponseBody | undefined;
    if (error.response?.status === 403 && body?.banned) {
      useAuthStore.getState().setPendingBanInfo({
        permanent: !!body.permanent,
        suspendedUntil: body.suspendedUntil ?? null,
        reason: body.reason ?? null,
      });
      cancelPendingRequests();
      useAuthStore.getState().clearAuth();
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      return Promise.reject(error);
    }

    // Only attempt refresh for 401 errors that haven't already been retried
    // and are NOT on the refresh/login endpoints themselves
    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/login');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      isRefreshing = true;

      try {
        // Read stored refresh token (native) or rely on cookie (web)
        const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

        const response = await axios.post<{
          success: boolean;
          data: { accessToken: string };
        }>(
          `${BASE_URL}/api/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: storedRefreshToken
              ? { Authorization: `Bearer ${storedRefreshToken}` }
              : {},
          },
        );

        const { accessToken } = response.data.data;
        await persistRefreshToken(
          response.headers as Record<string, string | string[] | undefined>
        );
        useAuthStore.getState().setAccessToken(accessToken);

        processQueue(null, accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh failed → force logout
        useAuthStore.getState().clearAuth();
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
