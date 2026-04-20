import axios from 'axios';
import apiClient from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

type PWDPayload = {
  username?: string;
  dob?: string;
  disabilityType?: string;
  disabilitySince?: number;
  houseNo?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
};

type CaregiverPayload = {
  careeName?: string;
  relation?: string;
  careeDob?: string;
  careDisability?: string;
  careSince?: number;
};

type TherapistPayload = {
  username?: string;
  dob?: string;
  specialty?: string;
  institution?: string;
  yearsOfExperience?: number;
  focusAreas?: string[];
  city?: string;
  district?: string;
  state?: string;
};

type NGOPayload = {
  contactPersonName?: string;
  username?: string;
  organizationName?: string;
  registrationNumber?: string;
  organizationType?: string;
  servicesOffered?: string[];
  city?: string;
  pincode?: string;
  website?: string;
};

function isConflictError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 409;
}

async function createOrUpdateProfile<T>(
  createPath: string,
  updatePath: string,
  payload: Record<string, unknown>
): Promise<T> {
  try {
    const response = await apiClient.post<ApiResponse<T>>(createPath, payload);
    return response.data.data;
  } catch (error) {
    if (!isConflictError(error)) {
      throw error;
    }

    const response = await apiClient.put<ApiResponse<T>>(updatePath, payload);
    return response.data.data;
  }
}

export function optionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function optionalNumber(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function normalizeUsername(value?: string) {
  const trimmed = optionalString(value);
  return trimmed ? trimmed.replace(/^@+/, '') : undefined;
}

export function parseDateInput(
  value: string | undefined,
  format: 'DMY' | 'MDY'
) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(/\./g, '/').replace(/-/g, '/');
  const parts = normalized.split('/').map((part) => part.trim());
  if (parts.length !== 3) {
    return undefined;
  }

  let year: number;
  let month: number;
  let day: number;

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
  if (Number.isNaN(isoDate.getTime())) {
    return undefined;
  }

  return isoDate.toISOString();
}

export async function submitPWDProfile(userId: string, payload: PWDPayload) {
  return createOrUpdateProfile(
    '/api/users/profiles/pwd',
    `/api/users/profiles/pwd/${userId}`,
    payload
  );
}

export async function submitCaregiverProfile(userId: string, payload: CaregiverPayload) {
  return createOrUpdateProfile(
    '/api/users/profiles/caregiver',
    `/api/users/profiles/caregiver/${userId}`,
    payload
  );
}

export async function submitTherapistProfile(userId: string, payload: TherapistPayload) {
  return createOrUpdateProfile(
    '/api/users/profiles/therapist',
    `/api/users/profiles/therapist/${userId}`,
    payload
  );
}

export async function submitNGOProfile(userId: string, payload: NGOPayload) {
  return createOrUpdateProfile(
    '/api/users/profiles/ngo',
    `/api/users/profiles/ngo/${userId}`,
    payload
  );
}
