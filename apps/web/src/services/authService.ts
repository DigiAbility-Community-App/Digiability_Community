import apiClient from './apiClient';
import { useAuthStore, type User } from '../store/authStore';

export const authService = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/api/auth/login', { email, password });
    
    if (response.data.success) {
      const { accessToken, user } = response.data.data;
      const store = useAuthStore.getState();
      
      store.setAccessToken(accessToken);
      store.setUser(user);
      
      return user as User;
    }
    throw new Error(response.data.message || 'Login failed');
  },

  register: async (name: string, email: string, password: string) => {
    const response = await apiClient.post('/api/auth/register', { name, email, password });

    if (response.data.success) {
      const { accessToken, user } = response.data.data;
      const store = useAuthStore.getState();

      store.setAccessToken(accessToken);
      store.setUser(user);

      return user as User;
    }
    throw new Error(response.data.message || 'Registration failed');
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/api/auth/me');
    // Server returns { success: true, data: { user: {...} } }
    const data = response.data.data;
    return data.user || data;
  },

  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (e) {
      console.warn('Logout API failed, clearing local state anyway');
    } finally {
      useAuthStore.getState().clearAuth();
    }
  }
};
