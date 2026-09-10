import apiClient from './apiClient';

// ─────────────────────────────────────────────────────────
// Privacy Service (DPDP Act 2023)
// Typed wrappers around user-svc's /api/auth/privacy endpoints.
// ─────────────────────────────────────────────────────────

// Mirrors the ConsentType enum in services/user-svc/prisma/schema.prisma.
export type ConsentType =
  | 'DATA_PROCESSING'
  | 'TERMS_OF_USE'
  | 'COMMUNITY_GUIDELINES'
  | 'GUARDIAN_CONSENT'
  | 'PUSH_NOTIFICATIONS'
  | 'MARKETING';

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

interface ApiResponse<T = Record<string, never>> {
  success: boolean;
  message?: string;
  data: T;
}

export async function getConsents(): Promise<ConsentRecord[]> {
  const response = await apiClient.get<ApiResponse<{ consents: ConsentRecord[] }>>(
    '/api/auth/privacy/consent',
  );
  return response.data.data.consents;
}

// Note: POST/DELETE consent responses always return an empty `data: {}` —
// the server never echoes back the updated row, so callers must update
// their own local state optimistically rather than reading it from here.

export async function updateConsent(consentType: ConsentType, accepted: boolean): Promise<void> {
  await apiClient.post<ApiResponse>('/api/auth/privacy/consent', { consentType, accepted });
}

export async function withdrawConsent(consentType: ConsentType): Promise<void> {
  await apiClient.delete<ApiResponse>(`/api/auth/privacy/consent/${consentType}`);
}

export async function exportMyData(): Promise<DataExportBundle> {
  const response = await apiClient.get<ApiResponse<DataExportBundle>>('/api/auth/privacy/export');
  return response.data.data;
}

/**
 * Re-accept the Terms of Use and Community Guidelines at the current policy
 * version. Called from the re-acceptance prompt when /api/auth/me reports
 * policyReacceptanceRequired.
 */
export async function acceptPolicies(): Promise<void> {
  await Promise.all([
    updateConsent('TERMS_OF_USE', true),
    updateConsent('COMMUNITY_GUIDELINES', true),
  ]);
}

// ── Guardian attestation (DPDP §9) ────────────────────────
//
// NOTE: self-attested, not verified consent. The verification mechanism is a
// deliberate open decision — see guardian.service.ts on the server and
// docs/legal/06 §1.7.

export interface GuardianAttestation {
  id: string;
  subjectName: string;
  subjectIsMinor: boolean;
  relationship: string;
  conversationId: string | null;
  policyVersion: string;
  attestedAt: string;
  revokedAt: string | null;
}

export interface GuardianAttestationInput {
  subjectName: string;
  subjectIsMinor: boolean;
  relationship: string;
  conversationId?: string;
  subjectDob?: string;
}

export async function recordGuardianAttestation(
  input: GuardianAttestationInput,
): Promise<GuardianAttestation> {
  const response = await apiClient.post<ApiResponse<{ attestation: GuardianAttestation }>>(
    '/api/auth/privacy/guardian',
    input,
  );
  return response.data.data.attestation;
}

export async function getGuardianAttestations(): Promise<GuardianAttestation[]> {
  const response = await apiClient.get<ApiResponse<{ attestations: GuardianAttestation[] }>>(
    '/api/auth/privacy/guardian',
  );
  return response.data.data.attestations;
}

export async function revokeGuardianAttestation(id: string): Promise<void> {
  await apiClient.delete<ApiResponse>(`/api/auth/privacy/guardian/${id}`);
}
