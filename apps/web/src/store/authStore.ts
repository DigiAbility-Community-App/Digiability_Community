import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  profileComplete: boolean;
  isEmailVerified: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  pendingRoles: string[];
  pendingProfile: any;
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  setPendingRoles: (roles: string[]) => void;
  setPendingProfile: (profile: any) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  accessToken: null,
  pendingRoles: [],
  pendingProfile: null,

  setUser: (user: User) => {
    set({ user, isAuthenticated: true });
  },

  setAccessToken: (token: string) => {
    set({ accessToken: token });
  },
  
  setPendingRoles: (roles: string[]) => set({ pendingRoles: roles }),
  
  setPendingProfile: (profile: any) => set({ pendingProfile: profile }),

  clearAuth: () => {
    set({ user: null, accessToken: null, isAuthenticated: false, pendingRoles: [], pendingProfile: null });
    localStorage.removeItem('digiability_refresh_token');
  },
}));
