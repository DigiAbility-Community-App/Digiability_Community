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
  roles?: string[];
  profileComplete: boolean;
  isEmailVerified: boolean;
  fullName?: string;
  username?: string;
}

// Basic profile fields collected during onboarding (not yet in DB)
export interface PendingBasicProfile {
  fullName?: string;
  username?: string;
  dob?: string;      // ISO 8601 string or undefined
  gender?: string;
  city?: string;
  state?: string;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  // ── Onboarding pending state ──────────────────────────────
  // Data collected across screens but NOT yet written to DB.
  // Written atomically on the final ProfileDetails submit.
  pendingRole: string | null; // Keep for backward compatibility/single values
  pendingRoles: string[];
  pendingProfile: PendingBasicProfile | null;

  // Actions
  setAuth: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;

  // Onboarding pending actions
  setPendingRole: (role: string) => void;
  setPendingRoles: (roles: string[]) => void;
  setPendingProfile: (profile: PendingBasicProfile) => void;
  clearPending: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  pendingRole: null,
  pendingRoles: [],
  pendingProfile: null,

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
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      pendingRole: null,
      pendingRoles: [],
      pendingProfile: null,
    }),

  setPendingRole: (role) => set({ pendingRole: role, pendingRoles: [role] }),

  setPendingRoles: (roles) => set({ pendingRoles: roles, pendingRole: roles[0] || null }),

  setPendingProfile: (profile) => set({ pendingProfile: profile }),

  clearPending: () => set({ pendingRole: null, pendingRoles: [], pendingProfile: null }),
}));
