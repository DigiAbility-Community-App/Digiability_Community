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
  phoneNo?: string | null;
}

// Basic profile fields collected during onboarding (not yet in DB)
export interface PendingBasicProfile {
  fullName?: string;
  username?: string;
  dob?: string;      // ISO 8601 string or undefined
  gender?: string;
  city?: string;
  state?: string;
  addressLine1?: string;
  streetArea?: string;
  pincode?: string;
  locationDistrict?: string;
  phoneNo?: string;
}

export interface BanInfo {
  permanent: boolean;
  suspendedUntil: string | null;
  reason: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  // Set when a request comes back with a ban response so the app can force
  // logout + show a proper "account suspended" screen instead of a generic
  // error, even if the user was already mid-session. Deliberately NOT reset
  // by clearAuth() — it's read once by the auth stack after the forced
  // logout it triggers, then cleared explicitly.
  pendingBanInfo: BanInfo | null;
  setPendingBanInfo: (info: BanInfo) => void;
  clearPendingBanInfo: () => void;

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
  pendingBanInfo: null,
  pendingRole: null,
  pendingRoles: [],
  pendingProfile: null,

  setPendingBanInfo: (info) => set({ pendingBanInfo: info }),
  clearPendingBanInfo: () => set({ pendingBanInfo: null }),

  setAuth: (accessToken, user) =>
    set({ accessToken, user, isAuthenticated: true }),

  setAccessToken: (accessToken) =>
    set({ accessToken }),

  setUser: (user) =>
    set((state) => ({
      accessToken: state.accessToken,
      user,
      isAuthenticated: user != null,
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

  setPendingRoles: (roles) => set({ pendingRoles: roles, pendingRole: roles[0] ?? null }),

  setPendingProfile: (profile) => set({ pendingProfile: profile }),

  clearPending: () => set({ pendingRole: null, pendingRoles: [], pendingProfile: null }),
}));
