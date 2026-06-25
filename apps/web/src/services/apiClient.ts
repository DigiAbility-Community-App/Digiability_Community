import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const BASE_URL = 'http://localhost:4001';

export const REFRESH_TOKEN_KEY = 'digiability_refresh_token';

async function persistRefreshToken(
  headers: Record<string, string | string[] | undefined>
) {
  const headerToken = headers['x-refresh-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    localStorage.setItem(REFRESH_TOKEN_KEY, headerToken);
    return;
  }

  const setCookie = headers['set-cookie'];
  if (!setCookie) return;

  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match =
    cookieStr.match(/refreshToken=([^;]+)/) ??
    cookieStr.match(/refresh_token=([^;]+)/);

  if (match?.[1]) {
    localStorage.setItem(REFRESH_TOKEN_KEY, match[1]);
  }
}

// ── Axios instance ─────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/login');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
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
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

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
        useAuthStore.getState().clearAuth();
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
