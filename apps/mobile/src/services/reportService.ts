import apiClient from './apiClient';

// ─────────────────────────────────────────────────────────────
// Report Service
// Submits user reports for users, messages, and groups.
// ─────────────────────────────────────────────────────────────

export type ReportTargetType = 'USER' | 'MESSAGE' | 'GROUP';

// Reason vocabulary lives in one place now — see constants/reportReasons.
// Re-exported here so existing imports from this module keep working.
export type { ReportReason } from '../constants/reportReasons';
export { REPORT_REASON_LABELS, REPORT_REASONS } from '../constants/reportReasons';

import type { ReportReason } from '../constants/reportReasons';

export interface SubmitReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

export async function submitReport(
  input: SubmitReportInput,
): Promise<{ id: string; referenceCode: string }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { id: string; referenceCode: string };
  }>('/api/reports', input);
  return response.data.data;
}
