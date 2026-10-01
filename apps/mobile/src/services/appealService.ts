import apiClient from './apiClient';

// ─────────────────────────────────────────────────────────
// Appeal Service — Community Guidelines "Appeals"
//
// Published commitments: appeal within 30 days of the decision notice; we
// respond within 14 days, or 7 if the account is suspended; reviewed by
// someone who was not involved in the original decision.
// ─────────────────────────────────────────────────────────

export type AppealStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'UPHELD'
  | 'OVERTURNED'
  | 'REJECTED';

export interface Appeal {
  referenceCode: string;
  targetId: string;
  grounds: string;
  status: AppealStatus;
  submittedAt: string;
  dueBy: string;
  respondedAt: string | null;
  decisionNote: string | null;
}

export type Appealability =
  | { appealable: true; deadline: string }
  | {
      appealable: false;
      reason: 'not_found' | 'already_appealed' | 'window_closed';
      deadline?: string;
      existing?: { referenceCode: string; status: AppealStatus };
    };

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

/** Whether this decision can still be appealed — drives the Appeal button. */
export async function checkAppealability(auditLogId: string): Promise<Appealability> {
  const response = await apiClient.get<ApiResponse<Appealability>>(
    `/api/appeals/eligibility/${auditLogId}`,
  );
  return response.data.data;
}

export async function submitAppeal(input: {
  auditLogId: string;
  grounds: string;
}): Promise<{ referenceCode: string; dueBy: string; message: string }> {
  const response = await apiClient.post<ApiResponse<{ referenceCode: string; dueBy: string }>>(
    '/api/appeals',
    input,
  );
  return {
    referenceCode: response.data.data.referenceCode,
    dueBy: response.data.data.dueBy,
    message: response.data.message ?? '',
  };
}

export async function getMyAppeals(): Promise<Appeal[]> {
  const response = await apiClient.get<ApiResponse<{ appeals: Appeal[] }>>('/api/appeals');
  return response.data.data.appeals;
}
