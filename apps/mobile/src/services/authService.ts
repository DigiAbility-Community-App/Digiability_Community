import * as SecureStore from 'expo-secure-store';
import apiClient, { REFRESH_TOKEN_KEY, cancelPendingRequests } from './apiClient';
import { useAuthStore, AuthUser } from '@store/authStore';
import { useChatStore } from '@store/chatStore';
import { useForumStore } from '@store/forumStore';
import { removeDeviceToken } from './notificationService';
import { closeSocket } from './socketService';
import { forumSocketService } from './forumSocketService';

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
  /** Required — user-svc's RegisterSchema rejects a request without this. */
  acceptedTerms: true;
  /** The policy version actually shown to the user; see legal-docs.generated. */
  policyVersion: string;
  /** Separate consent to the data-processing notice — the user ticked its own box. */
  acceptedDataProcessing: true;
  /** The notice version actually shown (CONSENT_NOTICE_VERSION). */
  consentNoticeVersion: string;
  /** YYYY-MM-DD. Required — Digiability is an 18+ platform (DPDP §9). */
  dateOfBirth: string;
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

// The DB Role enum predates the app's role vocabulary, so three ids differ
// from what the user sees. Skill Trainer stores as `student` and Volunteer as
// `volunteer` — these were swapped by migration 20260908010000 so that the
// "Volunteer" the user picks is literally `volunteer` in the database.
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

// ── Email availability (signup) ────────────────────────────

export interface EmailCheckResult {
  available: boolean;
  message: string;
}

/**
 * Live "is this email already registered?" check for the signup form, so the
 * user finds out while typing rather than after submitting. Mirrors
 * checkUsernameAvailability in profileService.
 */
export async function checkEmailAvailability(email: string): Promise<EmailCheckResult> {
  try {
    // POST so the address never appears in a URL (proxy/access logs).
    const response = await apiClient.post<{ success: boolean; available: boolean; message: string }>(
      '/api/auth/check-email',
      { email: email.trim().toLowerCase() },
    );
    return { available: response.data.available, message: response.data.message };
  } catch (error: any) {
    if (error?.response?.status === 400) {
      return { available: false, message: error.response.data?.message ?? 'Enter a valid email address' };
    }
    // Network/server error (or the rate limit) — don't block the user on a
    // check that couldn't run; registration still validates server-side.
    return { available: true, message: '' };
  }
}

// ── Register ───────────────────────────────────────────────

export async function register(
  input: RegisterInput
): Promise<AuthUser & { otpEmailSent?: boolean }> {
  const mappedInput = {
    ...input,
    role: input.role ? (ROLE_MAP_TO_BACKEND[input.role] ?? input.role) : undefined,
    roles: input.roles ? input.roles.map(r => ROLE_MAP_TO_BACKEND[r] ?? r) : undefined,
  };

  const response = await apiClient.post<ApiResponse<LoginResponseData & { otpEmailSent?: boolean }>>(
    '/api/auth/register',
    mappedInput,
  );

  // Registration no longer returns a session — the server issues tokens only
  // after the OTP is verified, so an unverified account can't reach the API.
  // The caller sends the user to the Verify Email screen with this email.
  const { user, otpEmailSent } = response.data.data;
  const mappedUser = mapUserToFrontend(user);

  return { ...mappedUser, otpEmailSent };
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

// Server calls on logout are best-effort; never leave the user stuck on a
// spinner because the network is down.
const LOGOUT_TIMEOUT_MS = 5000;

/**
 * Wipe everything this device holds for the signed-in user: refresh token,
 * auth header, live sockets, queued requests and cached user data.
 */
async function wipeLocalSession(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
  delete apiClient.defaults.headers.common.Authorization;
  closeSocket();
  forumSocketService.disconnect();
  cancelPendingRequests();
  // Clears auth + all user-scoped stores (chat, forum) so the next user
  // starts clean and no in-flight response can repopulate them.
  clearUserScopedStores();
}

/**
 * Log out of this device. The server is told FIRST — while the access and
 * refresh tokens still exist — so it can revoke the session; only then is
 * local state wiped. (Clearing first meant the logout call went out with no
 * credentials and the server never revoked anything: VAPT M-003.)
 */
export async function logout(): Promise<void> {
  // DELETE /api/auth/device-token needs the still-valid bearer token.
  try {
    await removeDeviceToken();
  } catch {
    // Best-effort — never block logout on this.
  }

  try {
    // The refresh token in the body lets the server end the session even if
    // the access token has already expired.
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
    await apiClient.post(
      '/api/auth/logout',
      refreshToken ? { refreshToken } : {},
      { timeout: LOGOUT_TIMEOUT_MS },
    );
  } catch {
    // Offline or server error — still log out locally.
  }

  await wipeLocalSession();
}

/**
 * Log out of every device signed in to this account (all sessions are
 * revoked server-side), then wipe this one.
 * Throws if the server call fails, so the UI can say so — unlike plain
 * logout, silently "succeeding" here would leave other devices signed in.
 */
export async function logoutAllDevices(): Promise<void> {
  try {
    await removeDeviceToken();
  } catch {
    // Best-effort.
  }

  await apiClient.post('/api/auth/logout-all', {}, { timeout: LOGOUT_TIMEOUT_MS });
  await wipeLocalSession();
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
  const response = await apiClient.post<ApiResponse<LoginResponseData>>(
    '/api/auth/verify-email',
    { email, otp },
  );

  // Verification is now the point where the session starts: the server
  // returns the access token here (and the refresh token in the headers)
  // rather than at registration.
  const { accessToken, user } = response.data.data;
  await persistRefreshToken(response.headers as Record<string, string | string[]>);
  useAuthStore.getState().setAuth(accessToken, mapUserToFrontend(user));

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

export async function deleteAccount(password: string): Promise<void> {
  // The server requires re-authentication for this irreversible action, so the
  // password travels in the request body (axios needs `data` for DELETE).
  await apiClient.delete('/api/auth/delete-account', { data: { password } });
  // Clear all local state after the server confirms deletion
  clearUserScopedStores();
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

/**
 * Backfill a date of birth for an account created before the age gate.
 * Returns whether the declared date meets the 18+ requirement; an ineligible
 * (but plausible) date is recorded and routed to moderation, not rejected.
 */
export async function submitDateOfBirth(
  dateOfBirth: string,
): Promise<{ eligible: boolean; message: string }> {
  const response = await apiClient.post<ApiResponse<{ eligible: boolean }>>(
    '/api/auth/date-of-birth',
    { dateOfBirth },
  );
  return {
    eligible: response.data.data.eligible,
    message: response.data.message ?? '',
  };
}
