import * as SecureStore from 'expo-secure-store';
import apiClient, { REFRESH_TOKEN_KEY, cancelPendingRequests } from './apiClient';
import { useAuthStore, AuthUser } from '@store/authStore';
import { useChatStore } from '@store/chatStore';
import { useForumStore } from '@store/forumStore';
import { removeDeviceToken } from './notificationService';

/**
 * Wipes all user-scoped in-memory state. Called on logout and account
 * deletion so the next user who logs in on this device never sees the
 * previous user's conversations, forum posts, bookmarks, etc.
 */
function clearUserScopedStores() {
  useAuthStore.getState().clearAuth();
  useChatStore.getState().clearStore();
  useForumStore.getState().clearStore();
}

// ─────────────────────────────────────────────────────────
// Auth Service
// Typed wrappers around every user-svc auth endpoint.
// ─────────────────────────────────────────────────────────

// ── Types ──────────────────────────────────────────────────

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phoneNo?: string;
  role?: string;
  roles?: string[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  email: string;
  otp: string;
  password: string;
}

interface ApiResponse<T = Record<string, never>> {
  success: boolean;
  message: string;
  data: T;
}

interface LoginResponseData {
  accessToken: string;
  user: AuthUser;
  // refreshToken is in Set-Cookie header (web) or response header (native)
}

// ── Helpers ────────────────────────────────────────────────

/**
 * On native, the server cannot set HttpOnly cookies directly.
 * We extract the refresh token from the response headers if the server
 * returns it in X-Refresh-Token, or from a custom response field.
 *
 * For now, the user-svc sets a cookie — on native we read it from the
 * axios response `set-cookie` header and persist it to SecureStore.
 */
async function persistRefreshToken(headers: Record<string, string | string[]>) {
  const headerToken = headers['x-refresh-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, headerToken);
    return;
  }

  const setCookie = headers['set-cookie'];
  if (!setCookie) return;

  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  // Cookie format: refreshToken=<value>; Path=/; HttpOnly; ...
  const match =
    cookieStr.match(/refreshToken=([^;]+)/) ??
    cookieStr.match(/refresh_token=([^;]+)/);
  if (match?.[1]) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, match[1]);
  }
}

// ── Role Mapping ───────────────────────────────────────────

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

// ── Register ───────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<AuthUser> {
  const mappedInput = {
    ...input,
    role: input.role ? (ROLE_MAP_TO_BACKEND[input.role] ?? input.role) : undefined,
    roles: input.roles ? input.roles.map(r => ROLE_MAP_TO_BACKEND[r] ?? r) : undefined,
  };

  const response = await apiClient.post<ApiResponse<LoginResponseData>>(
    '/api/auth/register',
    mappedInput,
  );

  const { accessToken, user } = response.data.data;
  const mappedUser = mapUserToFrontend(user);
  await persistRefreshToken(response.headers as Record<string, string | string[]>);
  useAuthStore.getState().setAuth(accessToken, mappedUser);

  return mappedUser;
}

// ── Login ──────────────────────────────────────────────────

export async function login(input: LoginInput): Promise<AuthUser> {
  // Defensively wipe any leftover state from a previous session that
  // wasn't cleanly logged out (e.g. an app crash), so switching accounts
  // never surfaces the prior user's cached chat/forum data.
  useChatStore.getState().clearStore();
  useForumStore.getState().clearStore();

  const response = await apiClient.post<ApiResponse<LoginResponseData>>(
    '/api/auth/login',
    input,
  );

  const { accessToken, user } = response.data.data;
  const mappedUser = mapUserToFrontend(user);

  // Persist refresh token from cookie header (native)
  await persistRefreshToken(response.headers as Record<string, string | string[]>);

  // Store access token + user in memory
  useAuthStore.getState().setAuth(accessToken, mappedUser);

  return mappedUser;
}

// ── Logout ─────────────────────────────────────────────────

export async function logout(): Promise<void> {
  // Must run before clearAuth() below — DELETE /api/auth/device-token needs
  // the still-valid bearer token from the auth store.
  try {
    await removeDeviceToken();
  } catch {
    // Best-effort — never block logout on this.
  }

  // H11: Clear local state FIRST to prevent any in-flight responses
  // writing stale data to the stores after logout. Clears auth + all
  // user-scoped stores (chat, forum) so the next user starts clean.
  clearUserScopedStores();
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);

  // Then cancel pending requests and notify the server (best-effort)
  cancelPendingRequests();
  try {
    await apiClient.post('/api/auth/logout');
  } catch {
    // Swallow — local state is already cleared
  }
}

// ── Get current user (protected) ───────────────────────────

export async function getMe(): Promise<AuthUser> {
  const response = await apiClient.get<ApiResponse<{ user: AuthUser }>>('/api/auth/me');
  return mapUserToFrontend(response.data.data.user);
}

// ── Forgot password ────────────────────────────────────────

export async function forgotPassword(input: ForgotPasswordInput): Promise<string> {
  const response = await apiClient.post<ApiResponse>(
    '/api/auth/forgot-password',
    input,
  );
  return response.data.message;
}

// ── Reset password ─────────────────────────────────────────

export async function resetPassword(input: ResetPasswordInput): Promise<string> {
  const response = await apiClient.post<ApiResponse>(
    '/api/auth/reset-password',
    input,
  );
  return response.data.message;
}

// ── Verify email OTP ───────────────────────────────────

export async function verifyEmailOtp(email: string, otp: string): Promise<string> {
  const response = await apiClient.post<ApiResponse>(
    '/api/auth/verify-email',
    { email, otp },
  );

  // Update auth store with verified status
  const currentUser = useAuthStore.getState().user;
  if (currentUser) {
    useAuthStore.getState().setAuth(
      useAuthStore.getState().accessToken!,
      { ...currentUser, isEmailVerified: true }
    );
  }

  return response.data.message;
}

// ── Resend verification OTP ────────────────────────────

export async function resendVerificationOtp(email: string): Promise<string> {
  const response = await apiClient.post<ApiResponse>(
    '/api/auth/resend-otp',
    { email },
  );
  return response.data.message;
}

// ── Update current user roles ───────────────────────────────

export async function updateRoles(
  roles: string[],
  options: { updateStore?: boolean } = {}
): Promise<AuthUser> {
  const backendRoles = roles.map(role => ROLE_MAP_TO_BACKEND[role] ?? role);
  const response = await apiClient.patch<ApiResponse<AuthUser>>('/api/auth/role', {
    roles: backendRoles,
  });

  const mappedUser = mapUserToFrontend(response.data.data);
  
  if (options.updateStore ?? true) {
    useAuthStore.getState().setAuth(
      useAuthStore.getState().accessToken!,
      mappedUser
    );
  }
  
  return mappedUser;
}

export async function updateRole(
  role: string,
  options: { updateStore?: boolean } = {}
): Promise<AuthUser> {
  return updateRoles([role], options);
}

// ── Delete account (DPDP right to erasure) ─────────────────

export async function deleteAccount(): Promise<void> {
  await apiClient.delete('/api/auth/delete-account');
  // Clear all local state after the server confirms deletion
  clearUserScopedStores();
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
