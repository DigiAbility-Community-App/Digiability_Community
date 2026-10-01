import apiClient from './apiClient';

// ─────────────────────────────────────────────────────────
// Grievance Service — IT Rules 2021 Rule 3(2)
//
// The formal complaint mechanism. Distinct from reportService, which is about
// a specific piece of content; a grievance is about the platform's own conduct,
// including how a report was handled.
//
// Published commitment (Terms §15): acknowledged within 24 hours, resolved
// within 15 days, with a ticket reference.
// ─────────────────────────────────────────────────────────

export type GrievanceStatus =
  | 'RECEIVED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export interface GrievanceTicket {
  referenceCode: string;
  category: string;
  subject: string;
  status: GrievanceStatus;
  receivedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

interface ApiResponse<T = Record<string, never>> {
  success: boolean;
  message?: string;
  data: T;
}

export async function submitGrievance(input: {
  category: string;
  subject: string;
  body: string;
}): Promise<{ referenceCode: string; message: string }> {
  const response = await apiClient.post<ApiResponse<{ referenceCode: string }>>(
    '/api/grievances',
    input,
  );
  return {
    referenceCode: response.data.data.referenceCode,
    message: response.data.message ?? '',
  };
}

export async function getMyGrievances(): Promise<GrievanceTicket[]> {
  const response = await apiClient.get<ApiResponse<{ grievances: GrievanceTicket[] }>>(
    '/api/grievances',
  );
  return response.data.data.grievances;
}
