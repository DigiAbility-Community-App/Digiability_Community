import { ReportReason, ReportSeverity } from "../generated/client";

// ─────────────────────────────────────────────────────
// Report Severity
//
// Encodes the "How we respond to reports" table published in the Community
// Guidelines. Severity is derived from the reason on the server rather than
// accepted from the client — a reporter choosing their own priority would make
// the published SLA meaningless.
//
// Keep this in step with docs/legal/02-community-guidelines.md. If that table
// changes, this map and ACKNOWLEDGE_WITHIN_MS/ACT_WITHIN_MS change with it.
// ─────────────────────────────────────────────────────

const SEVERITY_BY_REASON: Record<ReportReason, ReportSeverity> = {
  // "CSAE, credible threats of violence, trafficking — acknowledge and act immediately"
  CSAE: ReportSeverity.CRITICAL,
  VIOLENCE: ReportSeverity.CRITICAL,
  ILLEGAL_ACTIVITY: ReportSeverity.CRITICAL,

  // "Risk of self-harm — acknowledge within 4 hours, act same day"
  SELF_HARM: ReportSeverity.HIGH,

  // "Non-consensual intimate imagery, impersonation — acknowledge and act within 24 hours"
  PRIVACY_VIOLATION: ReportSeverity.ELEVATED,
  IMPERSONATION: ReportSeverity.ELEVATED,

  // "Harassment, hate speech, sexual content — acknowledge 24h, act 72h"
  HARASSMENT: ReportSeverity.MEDIUM,
  HATE_SPEECH: ReportSeverity.MEDIUM,
  SEXUAL_CONTENT: ReportSeverity.MEDIUM,
  HEALTH_MISINFORMATION: ReportSeverity.MEDIUM,
  SCAM_FRAUD: ReportSeverity.MEDIUM,
  BAN_EVASION: ReportSeverity.MEDIUM,
  INAPPROPRIATE_CONTENT: ReportSeverity.MEDIUM,
  // Unknown intent — treat as mid-tier rather than lowest, so an unusual report
  // isn't buried behind spam.
  OTHER: ReportSeverity.MEDIUM,

  // "Spam and lower-severity reports — acknowledge 72h, act 7 days"
  SPAM: ReportSeverity.LOW,
  MISINFORMATION: ReportSeverity.LOW,
  IP_INFRINGEMENT: ReportSeverity.LOW,
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Acknowledgement deadline per severity, from the published table. */
export const ACKNOWLEDGE_WITHIN_MS: Record<ReportSeverity, number> = {
  CRITICAL: 0,
  HIGH: 4 * HOUR,
  ELEVATED: 24 * HOUR,
  MEDIUM: 24 * HOUR,
  LOW: 72 * HOUR,
};

/** Action deadline per severity, from the published table. */
export const ACT_WITHIN_MS: Record<ReportSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1 * DAY, // "same day"
  ELEVATED: 24 * HOUR,
  MEDIUM: 72 * HOUR,
  LOW: 7 * DAY,
};

export function severityForReason(reason: ReportReason): ReportSeverity {
  return SEVERITY_BY_REASON[reason] ?? ReportSeverity.MEDIUM;
}

export function acknowledgeDueAt(createdAt: Date, severity: ReportSeverity): Date {
  return new Date(createdAt.getTime() + ACKNOWLEDGE_WITHIN_MS[severity]);
}

export function actionDueAt(createdAt: Date, severity: ReportSeverity): Date {
  return new Date(createdAt.getTime() + ACT_WITHIN_MS[severity]);
}

/** True when a report has blown its acknowledgement deadline. */
export function isAcknowledgementOverdue(report: {
  createdAt: Date;
  severity: ReportSeverity;
  acknowledgedAt: Date | null;
}): boolean {
  if (report.acknowledgedAt) return false;
  return Date.now() > acknowledgeDueAt(report.createdAt, report.severity).getTime();
}
