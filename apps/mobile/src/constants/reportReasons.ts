// ─────────────────────────────────────────────────────────────
// Report Reasons — single source for every report surface
//
// There were previously three divergent hardcoded lists: a 4-item one in the
// chat ReportModal, a 7-item one on the user profile, and a 6-item one in the
// forum. None of them covered the 13 prohibited categories published in
// docs/legal/02-community-guidelines.md, so a person had no accurate way to
// report the most serious things — child safety among them.
//
// Keep in step with the ReportReason enum in services/user-svc/prisma/schema.prisma.
// ─────────────────────────────────────────────────────────────

export type ReportReason =
  | 'CSAE'
  | 'SELF_HARM'
  | 'VIOLENCE'
  | 'HARASSMENT'
  | 'HATE_SPEECH'
  | 'SEXUAL_CONTENT'
  | 'PRIVACY_VIOLATION'
  | 'HEALTH_MISINFORMATION'
  | 'SCAM_FRAUD'
  | 'ILLEGAL_ACTIVITY'
  | 'IMPERSONATION'
  | 'IP_INFRINGEMENT'
  | 'BAN_EVASION'
  | 'SPAM'
  | 'INAPPROPRIATE_CONTENT'
  | 'MISINFORMATION'
  | 'OTHER';

export interface ReportReasonOption {
  key: ReportReason;
  /** Shown in the picker. */
  label: string;
  /** One-line clarification, for reasons whose scope isn't obvious. */
  hint?: string;
  /** Routed to a priority queue and surfaced above everything else. */
  priority?: boolean;
}

// Ordered most-serious first so the gravest options are reachable without
// scrolling, matching the order of the Guidelines' prohibited-content list.
export const REPORT_REASONS: ReportReasonOption[] = [
  { key: 'CSAE', label: 'Child safety', hint: 'Content that sexualises or endangers a minor', priority: true },
  { key: 'VIOLENCE', label: 'Violence or threats', hint: 'Threats, graphic violence, or dangerous acts', priority: true },
  { key: 'SELF_HARM', label: 'Self-harm or suicide', hint: 'Content encouraging or instructing self-harm', priority: true },
  { key: 'HARASSMENT', label: 'Harassment or bullying' },
  { key: 'HATE_SPEECH', label: 'Hate speech or discrimination', hint: 'Includes ableism' },
  { key: 'SEXUAL_CONTENT', label: 'Sexual content or nudity' },
  { key: 'PRIVACY_VIOLATION', label: 'Privacy violation', hint: "Sharing someone's personal information without consent" },
  { key: 'HEALTH_MISINFORMATION', label: 'Harmful health misinformation', hint: 'Unproven cures, or discouraging medical care' },
  { key: 'SCAM_FRAUD', label: 'Scam or fraud' },
  { key: 'ILLEGAL_ACTIVITY', label: 'Illegal activity' },
  { key: 'IMPERSONATION', label: 'Impersonation or fake account' },
  { key: 'IP_INFRINGEMENT', label: 'Intellectual property' },
  { key: 'BAN_EVASION', label: 'Evading a block or ban' },
  { key: 'SPAM', label: 'Spam' },
  { key: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { key: 'MISINFORMATION', label: 'Misinformation' },
  { key: 'OTHER', label: 'Something else' },
];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = REPORT_REASONS.reduce(
  (acc, r) => ({ ...acc, [r.key]: r.label }),
  {} as Record<ReportReason, string>
);

export function labelForReason(key: ReportReason | string): string {
  return REPORT_REASON_LABELS[key as ReportReason] ?? String(key);
}

/** Reasons routed to the child-safety / high-severity priority queue. */
export const PRIORITY_REASONS: ReportReason[] = REPORT_REASONS.filter((r) => r.priority).map(
  (r) => r.key
);
