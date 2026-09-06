import apiClient from './apiClient';
import { useAuthStore, type User } from '../store/authStore';

const ROLE_MAP_TO_BACKEND: Record<string, string> = {
  pwd: 'pwd',
  caregiver: 'caregiver',
  educator: 'therapist',
  ngo_worker: 'ngo',
  skill_trainer: 'volunteer',
  community_member: 'student',
};

const ROLE_MAP_TO_FRONTEND: Record<string, string> = {
  pwd: 'pwd',
  caregiver: 'caregiver',
  therapist: 'educator',
  ngo: 'ngo_worker',
  volunteer: 'skill_trainer',
  student: 'community_member',
};

function mapUserToFrontend(user: any): any {
  if (!user) return user;
  const roles = user.roles ? user.roles.map((r: string) => ROLE_MAP_TO_FRONTEND[r] ?? r) : [];
  return {
    ...user,
    role: roles[0] || (user.role ? (ROLE_MAP_TO_FRONTEND[user.role] ?? user.role) : null),
    roles: roles,
  };
}

export const authService = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/api/auth/login', { email, password });
    
    if (response.data.success) {
      const { accessToken, user } = response.data.data;
      const mappedUser = mapUserToFrontend(user);
      const store = useAuthStore.getState();
      
      store.setAccessToken(accessToken);
      store.setUser(mappedUser);
      
      return mappedUser as User;
    }
    throw new Error(response.data.message || 'Login failed');
  },

  register: async (name: string, email: string, password: string) => {
    const response = await apiClient.post('/api/auth/register', { name, email, password });

    if (response.data.success) {
      // Registration no longer returns a session — the server issues tokens
      // only once the OTP is verified, so an unverified account cannot reach
      // the API. The caller routes to /verify-email with this email.
      const { user } = response.data.data;
      return mapUserToFrontend(user) as User;
    }
    throw new Error(response.data.message || 'Registration failed');
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/api/auth/me');
    const data = response.data.data;
    return mapUserToFrontend(data.user || data);
  },

  updateRoles: async (roles: string[], options: { updateStore?: boolean } = { updateStore: true }) => {
    const backendRoles = roles.map(r => ROLE_MAP_TO_BACKEND[r] ?? r);
    const response = await apiClient.patch('/api/auth/role', { roles: backendRoles });
    const user = mapUserToFrontend(response.data.data);
    
    if (options.updateStore) {
      useAuthStore.getState().setUser(user);
    }
    return user;
  },

  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (e) {
      console.warn('Logout API failed, clearing local state anyway');
    } finally {
      useAuthStore.getState().clearAuth();
    }
  },

  deleteAccount: async () => {
    await apiClient.delete('/api/auth/delete-account');
    useAuthStore.getState().clearAuth();
  },
};
