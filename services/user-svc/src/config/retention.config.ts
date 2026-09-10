// ─────────────────────────────────────────────────────
// Data Retention Policy — DPDP Act 2023 §8(7)
//
// Defines how long each class of data is kept after it is
// no longer needed for the purpose it was collected.
// All values are in days. Adjust after legal review.
//
// [LEGAL PLACEHOLDER] — these periods should be reviewed
// against DPDP Act 2023 §8(7) and any applicable sectoral
// regulations before the first production release.
// ─────────────────────────────────────────────────────

export const RETENTION_DAYS = {
  // Expired email-verification OTPs — very short-lived tokens, safe to purge quickly
  emailVerificationTokens: 1,

  // Expired password-reset tokens
  passwordResetTokens: 1,

  // Revoked refresh tokens kept for replay-detection; purge after max token lifetime + buffer
  revokedRefreshTokens: 35,

  // Admin audit log (append-only, immutable) — 2 years for compliance investigation window
  // [LEGAL PLACEHOLDER] — confirm with legal whether a longer period is required
  adminAuditLog: 730,

  // AI moderation flags — 1 year; older entries are unlikely to be needed for appeals
  moderationFlags: 365,

  // User report records — keep as long as audit log so admin actions can be cross-referenced
  userReports: 730,

  // Registration records after account cancellation. Required by the Information
  // Technology (Intermediary Guidelines) Rules 2021, which oblige an intermediary
  // to retain user registration information for 180 days after cancellation.
  // This is NOT a general retention period for user data — everything else is
  // erased immediately on deletion; only the sealed registration record survives.
  registrationRecords: 180,

  // Snapshots of content removed for violating the Guidelines or the law. Same
  // 180-day basis: the rules require removed information and associated records
  // be preserved for investigation.
  removedContent: 180,
} as const;

export type RetentionDaysKey = keyof typeof RETENTION_DAYS;
