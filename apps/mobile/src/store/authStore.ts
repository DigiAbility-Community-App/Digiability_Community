import { create } from 'zustand';

// ─────────────────────────────────────────────────────────
// Auth Store (Zustand)
// Access token is kept IN-MEMORY ONLY — never persisted.
// Refresh token is managed by apiClient via SecureStore.
// ─────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  profileComplete: boolean;
  isEmailVerified: boolean;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: (accessToken, user) =>
    set({ accessToken, user, isAuthenticated: true }),

  setAccessToken: (accessToken) =>
    set({ accessToken }),

  setUser: (user) =>
    set((state) => ({
      accessToken: state.accessToken,
      user,
      isAuthenticated: true,
    })),

  clearAuth: () =>
    set({ accessToken: null, user: null, isAuthenticated: false }),
}));
