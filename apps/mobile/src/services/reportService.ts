import apiClient from './apiClient';

// ─────────────────────────────────────────────────────────────
// Report Service
// Submits user reports for users, messages, and groups.
// ─────────────────────────────────────────────────────────────

export type ReportTargetType = 'USER' | 'MESSAGE' | 'GROUP';

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'HATE_SPEECH'
  | 'INAPPROPRIATE_CONTENT'
  | 'MISINFORMATION'
  | 'IMPERSONATION'
  | 'OTHER';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Spam',
  HARASSMENT: 'Harassment',
  HATE_SPEECH: 'Hate speech',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  MISINFORMATION: 'Misinformation',
  IMPERSONATION: 'Impersonation',
  OTHER: 'Other',
};

export interface SubmitReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

export async function submitReport(input: SubmitReportInput): Promise<{ id: string }> {
  const response = await apiClient.post<{ success: boolean; data: { id: string } }>(
    '/api/reports',
    input,
  );
  return response.data.data;
}
