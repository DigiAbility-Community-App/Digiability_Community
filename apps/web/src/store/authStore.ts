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
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  accessToken: null,

  setUser: (user: User) => {
    set({ user, isAuthenticated: true });
  },

  setAccessToken: (token: string) => {
    set({ accessToken: token });
  },

  clearAuth: () => {
    set({ user: null, accessToken: null, isAuthenticated: false });
    localStorage.removeItem('digiability_refresh_token');
  },
}));
