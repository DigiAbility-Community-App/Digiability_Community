import axios from 'axios';
import apiClient from './apiClient';
import { authService } from './authService';

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
  phoneNo?: string;
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
  // Reject rollovers like Feb 31 → Mar 3
  if (isoDate.getUTCDate() !== day || isoDate.getUTCMonth() + 1 !== month || isoDate.getUTCFullYear() !== year) {
    return undefined;
  }

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
    // Network/server error — treat as unavailable so user retries rather than submitting blindly
    return { available: false, message: 'Unable to verify — please try again' };
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

function logApiError(step: string, error: unknown) {
  if (axios.isAxiosError(error)) {
    console.log(`${step} failed`, {
      status: error.response?.status,
      data: error.response?.data,
    });
    return;
  }

  console.log(`${step} failed`, error);
}

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
  role?: string;
  roles?: string[];
  basicProfile: UserProfilePayload;
  roleDetails: ProfileDetailsPayload;
}): Promise<void> {
  const { userId, role, roles, basicProfile, roleDetails } = params;
  const rolesToSave = roles || (role ? [role] : []);

  // 1. Save roles
  try {
    await authService.updateRoles(rolesToSave, { updateStore: false });
  } catch (error) {
    logApiError('Update roles', error);
    throw error;
  }

  // 2. Save basic profile
  try {
    await submitUserProfile(userId, basicProfile);
  } catch (error) {
    logApiError('Submit basic profile', error);
    throw error;
  }

  // 3. Save role-specific details (server marks profileComplete=true)
  // Pass roles so the server can check completion without an extra DB round-trip (BUG-019)
  try {
    await submitProfileDetails(userId, { ...roleDetails, roles: rolesToSave });
  } catch (error) {
    logApiError('Submit profile details', error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Get user profile (for editing)
// ─────────────────────────────────────────────

function formatIsoToDmy(isoString?: string | null) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export async function getMyProfile() {
  const response = await apiClient.get<ApiResponse<any>>('/api/users/profile/me');
  const profile = response.data.data;
  if (profile) {
    profile.dob = formatIsoToDmy(profile.dob);
    // Extract role-specific fields into a typed sub-object for EditProfileScreen
    profile.roleDetails = {
      disabilityType: profile.disabilityType,
      disabilitySince: profile.disabilitySince,
      supportNeeded: profile.supportNeeded,
      carePersonName: profile.carePersonName,
      careRelation: profile.careRelation,
      careDob: profile.careDob,
      careDisabilityType: profile.careDisabilityType,
      speciality: profile.speciality,
      organization: profile.organization,
      yearsOfExperience: profile.yearsOfExperience,
      ngoName: profile.ngoName,
      ngoRole: profile.ngoRole,
      district: profile.district,
    };
  }
  return profile;
}

/** @deprecated Use getMyProfile() instead */
export async function getUserProfile(_userId: string) {
  return getMyProfile();
}

// ─────────────────────────────────────────────
// Update user profile (for editing)
// ─────────────────────────────────────────────

export async function updateUserProfile(params: {
  userId: string;
  basicProfile: any;
  roleDetails: any;
}) {
  const { basicProfile, roleDetails } = params;
  
  // Parse DOB if provided in DD/MM/YYYY format
  const parsedDob = basicProfile.dob?.trim()
    ? parseDateInput(basicProfile.dob.trim(), 'DMY')
    : undefined;
    
  // 1. Update basic profile
  const basicRes = await apiClient.put<ApiResponse<any>>('/api/users/profile', {
    ...basicProfile,
    dob: parsedDob,
  });
  
  // 2. Update role details
  const detailsRes = await apiClient.put<ApiResponse<any>>('/api/users/profile/details', roleDetails);
  
  return {
    basicProfile: basicRes.data.data,
    roleDetails: detailsRes.data.data,
  };
}
