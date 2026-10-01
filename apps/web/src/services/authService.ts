import apiClient from './apiClient';
import { useAuthStore, type User } from '../store/authStore';
import { POLICY_VERSION, CONSENT_NOTICE_VERSION } from '../legal/legal-docs.generated';

// Keep in sync with apps/mobile/src/services/authService.ts. Skill Trainer
// stores as `student` and Volunteer as `volunteer` — swapped by migration
// 20260908010000 so the "Volunteer" a user picks is literally `volunteer`.
const ROLE_MAP_TO_BACKEND: Record<string, string> = {
  pwd: 'pwd',
  caregiver: 'caregiver',
  educator: 'therapist',
  ngo_worker: 'ngo',
  skill_trainer: 'student',
  volunteer: 'volunteer',
};

const ROLE_MAP_TO_FRONTEND: Record<string, string> = {
  pwd: 'pwd',
  caregiver: 'caregiver',
  therapist: 'educator',
  ngo: 'ngo_worker',
  student: 'skill_trainer',
  volunteer: 'volunteer',
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

  register: async (name: string, email: string, password: string, dateOfBirth: string) => {
    // acceptedTerms/policyVersion are required by user-svc's RegisterSchema.
    // POLICY_VERSION comes from docs/legal/manifest.json via `npm run sync:legal`,
    // so what we record is the version of the text actually shown to the user.
    const response = await apiClient.post('/api/auth/register', {
      name,
      email,
      password,
      acceptedTerms: true,
      policyVersion: POLICY_VERSION,
      // Separate consent to the data-processing notice — its own checkbox.
      acceptedDataProcessing: true,
      consentNoticeVersion: CONSENT_NOTICE_VERSION,
      // Required — Digiability is an 18+ platform (DPDP §9).
      dateOfBirth,
    });

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

  deleteAccount: async (password: string) => {
    // The server requires re-authentication for this irreversible action.
    // Axios needs `data` for a DELETE body.
    await apiClient.delete('/api/auth/delete-account', { data: { password } });
    useAuthStore.getState().clearAuth();
  },
};
