import axios from 'axios';
import apiClient from './apiClient';
import { updateRole } from './authService';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// ─────────────────────────────────────────────
// Unified profile payload — same fields for all roles.
// The role tag is already stored on the User record.
// ─────────────────────────────────────────────
type UserProfilePayload = {
  fullName?: string;
  username?: string;
  dob?: string;      // ISO 8601 string
  gender?: string;
  city?: string;
  state?: string;
  pincode?: string;
  area?: string;
};

function isConflictError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 409;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function optionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function optionalNumber(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function normalizeUsername(value?: string) {
  const trimmed = optionalString(value);
  return trimmed ? trimmed.toLowerCase().replace(/^@+/, '') : undefined;
}

export function parseDateInput(
  value: string | undefined,
  format: 'DMY' | 'MDY'
) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.replace(/\./g, '/').replace(/-/g, '/');
  const parts = normalized.split('/').map((p) => p.trim());
  if (parts.length !== 3) return undefined;

  let year: number, month: number, day: number;

  if (parts[0].length === 4) {
    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
  } else if (format === 'DMY') {
    day = Number(parts[0]);
    month = Number(parts[1]);
    year = Number(parts[2]);
  } else {
    month = Number(parts[0]);
    day = Number(parts[1]);
    year = Number(parts[2]);
  }

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return undefined;
  }

  const isoDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(isoDate.getTime())) return undefined;

  return isoDate.toISOString();
}

// ─────────────────────────────────────────────
// Username Availability Check (real-time)
// Returns: { available: boolean; message: string }
// ─────────────────────────────────────────────

export interface UsernameCheckResult {
  available: boolean;
  message: string;
}

export async function checkUsernameAvailability(
  username: string
): Promise<UsernameCheckResult> {
  try {
    const response = await apiClient.get<{
      success: boolean;
      available: boolean;
      message: string;
    }>('/api/users/profile/check-username', {
      params: { username: username.toLowerCase().trim() },
    });
    return {
      available: response.data.available,
      message: response.data.message,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      return {
        available: false,
        message: error.response.data?.message ?? 'Invalid username format',
      };
    }
    // Network/server error — optimistically allow typing to continue
    return { available: true, message: '' };
  }
}

// ─────────────────────────────────────────────
// Single profile submit — creates or updates
// ─────────────────────────────────────────────

export async function submitUserProfile(
  _userId: string,
  payload: UserProfilePayload
) {
  try {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/api/users/profile',
      payload
    );
    return response.data.data;
  } catch (error) {
    if (!isConflictError(error)) throw error;
    // Profile already exists — update instead
    const response = await apiClient.put<ApiResponse<unknown>>(
      '/api/users/profile',
      payload
    );
    return response.data.data;
  }
}

// ─────────────────────────────────────────────
// Role-specific profile details submit
// Sent after the basic profile step.
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProfileDetailsPayload = Record<string, any>;

export async function submitProfileDetails(
  _userId: string,
  payload: ProfileDetailsPayload
) {
  try {
    const response = await apiClient.post<ApiResponse<unknown>>(
      '/api/users/profile/details',
      payload
    );
    return response.data.data;
  } catch (error) {
    if (!isConflictError(error)) throw error;
    // Details already saved — update instead
    const response = await apiClient.put<ApiResponse<unknown>>(
      '/api/users/profile/details',
      payload
    );
    return response.data.data;
  }
}

// ─────────────────────────────────────────────
// Composite Onboarding Submit
//
// Writes everything to DB atomically at the end of onboarding:
//   1. Persist role
//   2. Persist basic profile
//   3. Persist role-specific details
//
// If any step fails, throws — caller handles retry.
// ─────────────────────────────────────────────

export async function submitFullOnboarding(params: {
  userId: string;
  role: string;
  basicProfile: UserProfilePayload;
  roleDetails: ProfileDetailsPayload;
}): Promise<void> {
  const { userId, role, basicProfile, roleDetails } = params;

  // 1. Save role
  await updateRole(role);

  // 2. Save basic profile
  await submitUserProfile(userId, basicProfile);

  // 3. Save role-specific details (server marks profileComplete=true)
  await submitProfileDetails(userId, roleDetails);
}
