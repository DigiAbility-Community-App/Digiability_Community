import { apiClient } from './client';
import {
  User,
  PWDProfile,
  CaregiverProfile,
  TherapistProfile,
  NGOProfile,
  CreatePWDProfileRequest,
  UpdatePWDProfileRequest,
  CreateCaregiverProfileRequest,
  UpdateCaregiverProfileRequest,
  CreateTherapistProfileRequest,
  UpdateTherapistProfileRequest,
  CreateNGOProfileRequest,
  UpdateNGOProfileRequest,
  GetProfileResponse,
  CreateProfileResponse,
  UpdateProfileResponse,
  GetUserWithProfileResponse,
  UserRole,
  AnyProfile,
} from '@digiability/types';

const API_BASE = '/api/users';

// ─────────────────────────────────────────────
// USER ENDPOINTS
// ─────────────────────────────────────────────

export const userApi = {
  /** Get current user profile */
  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get(`${API_BASE}/me`);
    return data.data;
  },

  /** Get user by ID */
  getById: async (userId: string): Promise<User> => {
    const { data } = await apiClient.get(`${API_BASE}/${userId}`);
    return data.data;
  },

  /** Update user profile */
  update: async (userId: string, updates: Partial<User>): Promise<User> => {
    const { data } = await apiClient.put(`${API_BASE}/${userId}`, updates);
    return data.data;
  },

  /** Get user with their profile (role-based) */
  getUserWithProfile: async (userId: string): Promise<GetUserWithProfileResponse> => {
    const { data } = await apiClient.get(`${API_BASE}/${userId}/with-profile`);
    return data;
  },
};

// ─────────────────────────────────────────────
// PWD PROFILE ENDPOINTS
// ─────────────────────────────────────────────

export const pwdProfileApi = {
  /** Create PWD profile */
  create: async (payload: CreatePWDProfileRequest): Promise<PWDProfile> => {
    const { data } = await apiClient.post(`${API_BASE}/profiles/pwd`, payload);
    return data.data;
  },

  /** Get PWD profile for current user */
  getMe: async (): Promise<PWDProfile> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/pwd/me`);
    return data.data;
  },

  /** Get PWD profile by user ID */
  getByUserId: async (userId: string): Promise<PWDProfile> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/pwd/${userId}`);
    return data.data;
  },

  /** Update PWD profile */
  update: async (userId: string, updates: UpdatePWDProfileRequest): Promise<PWDProfile> => {
    const { data } = await apiClient.put(`${API_BASE}/profiles/pwd/${userId}`, updates);
    return data.data;
  },

  /** Delete PWD profile */
  delete: async (userId: string): Promise<void> => {
    await apiClient.delete(`${API_BASE}/profiles/pwd/${userId}`);
  },
};

// ─────────────────────────────────────────────
// CAREGIVER PROFILE ENDPOINTS
// ─────────────────────────────────────────────

export const caregiverProfileApi = {
  /** Create caregiver profile */
  create: async (payload: CreateCaregiverProfileRequest): Promise<CaregiverProfile> => {
    const { data } = await apiClient.post(`${API_BASE}/profiles/caregiver`, payload);
    return data.data;
  },

  /** Get caregiver profile for current user */
  getMe: async (): Promise<CaregiverProfile> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/caregiver/me`);
    return data.data;
  },

  /** Get caregiver profile by user ID */
  getByUserId: async (userId: string): Promise<CaregiverProfile> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/caregiver/${userId}`);
    return data.data;
  },

  /** Update caregiver profile */
  update: async (userId: string, updates: UpdateCaregiverProfileRequest): Promise<CaregiverProfile> => {
    const { data } = await apiClient.put(`${API_BASE}/profiles/caregiver/${userId}`, updates);
    return data.data;
  },

  /** Delete caregiver profile */
  delete: async (userId: string): Promise<void> => {
    await apiClient.delete(`${API_BASE}/profiles/caregiver/${userId}`);
  },
};

// ─────────────────────────────────────────────
// THERAPIST PROFILE ENDPOINTS
// ─────────────────────────────────────────────

export const therapistProfileApi = {
  /** Create therapist profile */
  create: async (payload: CreateTherapistProfileRequest): Promise<TherapistProfile> => {
    const { data } = await apiClient.post(`${API_BASE}/profiles/therapist`, payload);
    return data.data;
  },

  /** Get therapist profile for current user */
  getMe: async (): Promise<TherapistProfile> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/therapist/me`);
    return data.data;
  },

  /** Get therapist profile by user ID */
  getByUserId: async (userId: string): Promise<TherapistProfile> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/therapist/${userId}`);
    return data.data;
  },

  /** Update therapist profile */
  update: async (userId: string, updates: UpdateTherapistProfileRequest): Promise<TherapistProfile> => {
    const { data } = await apiClient.put(`${API_BASE}/profiles/therapist/${userId}`, updates);
    return data.data;
  },

  /** Delete therapist profile */
  delete: async (userId: string): Promise<void> => {
    await apiClient.delete(`${API_BASE}/profiles/therapist/${userId}`);
  },

  /** List therapists (with verification) */
  listVerified: async (filters?: {
    city?: string;
    specialty?: string;
    focusArea?: string;
  }): Promise<TherapistProfile[]> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/therapist/list/verified`, { params: filters });
    return data.data;
  },
};

// ─────────────────────────────────────────────
// NGO PROFILE ENDPOINTS
// ─────────────────────────────────────────────

export const ngoProfileApi = {
  /** Create NGO profile */
  create: async (payload: CreateNGOProfileRequest): Promise<NGOProfile> => {
    const { data } = await apiClient.post(`${API_BASE}/profiles/ngo`, payload);
    return data.data;
  },

  /** Get NGO profile for current user */
  getMe: async (): Promise<NGOProfile> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/ngo/me`);
    return data.data;
  },

  /** Get NGO profile by user ID */
  getByUserId: async (userId: string): Promise<NGOProfile> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/ngo/${userId}`);
    return data.data;
  },

  /** Update NGO profile */
  update: async (userId: string, updates: UpdateNGOProfileRequest): Promise<NGOProfile> => {
    const { data } = await apiClient.put(`${API_BASE}/profiles/ngo/${userId}`, updates);
    return data.data;
  },

  /** Delete NGO profile */
  delete: async (userId: string): Promise<void> => {
    await apiClient.delete(`${API_BASE}/profiles/ngo/${userId}`);
  },

  /** List verified NGOs */
  listVerified: async (filters?: {
    city?: string;
    service?: string;
  }): Promise<NGOProfile[]> => {
    const { data } = await apiClient.get(`${API_BASE}/profiles/ngo/list/verified`, { params: filters });
    return data.data;
  },
};

// ─────────────────────────────────────────────
// GENERIC PROFILE ENDPOINTS
// ─────────────────────────────────────────────

export const profileApi = {
  /** Get user profile based on their role */
  getByRole: async (userId: string, role: UserRole): Promise<AnyProfile> => {
    const { data } = await apiClient.get(`${API_BASE}/${userId}/profile/${role}`);
    return data.data;
  },

  /** Check if user has completed their profile */
  isProfileComplete: async (userId: string): Promise<boolean> => {
    const { data } = await apiClient.get(`${API_BASE}/${userId}/profile-status`);
    return data.data.profileComplete;
  },

  /** Mark profile as complete */
  markAsComplete: async (userId: string): Promise<void> => {
    await apiClient.patch(`${API_BASE}/${userId}/mark-complete`);
  },
};
