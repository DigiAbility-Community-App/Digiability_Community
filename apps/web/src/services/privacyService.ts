import apiClient from './apiClient';

export type ConsentType = 'DATA_PROCESSING' | 'PUSH_NOTIFICATIONS' | 'MARKETING';

export interface ConsentRecord {
  consentType: ConsentType;
  accepted: boolean;
  version: string;
  acceptedAt: string | null;
  withdrawnAt: string | null;
  updatedAt: string;
}

export interface DataExportBundle {
  exportedAt: string;
  userId: string;
  notice: string;
  account: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  mentorProfile: Record<string, unknown> | null;
  mentorReviewsGiven: Array<Record<string, unknown>>;
  deviceTokens: Array<{ platform: string; registeredAt: string }>;
  consents: Array<Record<string, unknown>>;
  reportsFiled: Array<Record<string, unknown>>;
  crossServiceData: { chatService: string; forumService: string };
}

// Note: POST/DELETE consent responses always return an empty `data: {}` —
// the server never echoes back the updated row, so callers must update
// their own local state optimistically rather than reading it from here.

export const privacyService = {
  getConsents: async (): Promise<ConsentRecord[]> => {
    const response = await apiClient.get('/api/auth/privacy/consent');
    return response.data.data.consents;
  },

  updateConsent: async (consentType: ConsentType, accepted: boolean): Promise<void> => {
    await apiClient.post('/api/auth/privacy/consent', { consentType, accepted });
  },

  withdrawConsent: async (consentType: ConsentType): Promise<void> => {
    await apiClient.delete(`/api/auth/privacy/consent/${consentType}`);
  },

  exportMyData: async (): Promise<DataExportBundle> => {
    const response = await apiClient.get('/api/auth/privacy/export');
    return response.data.data;
  },
};
