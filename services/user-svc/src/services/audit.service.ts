// ─────────────────────────────────────────────────────
// Audit Service — structured auth event logging
//
// Writes one JSON line per event to stdout so container
// log aggregators (CloudWatch, Datadog, GCP Logging) can
// ingest and alert on suspicious patterns.
//
// Deliberately avoids logging passwords, raw tokens, OTPs,
// or full email addresses (only the hash/domain suffix).
//
// Event types:
//   auth.login_success      — successful credential check
//   auth.login_failure      — wrong password (includes attempt count)
//   auth.account_locked     — lockout threshold crossed
//   auth.logout             — explicit logout
//   auth.token_reuse        — rotated refresh token replayed (theft signal)
//   auth.password_reset     — password changed via reset flow
//   auth.email_verified     — OTP accepted
//   auth.account_deleted    — soft-delete completed
//   auth.register           — new account created
// ─────────────────────────────────────────────────────

export type AuditEventType =
  | "auth.login_success"
  | "auth.login_failure"
  | "auth.account_locked"
  | "auth.logout"
  | "auth.token_reuse"
  | "auth.password_reset"
  | "auth.email_verified"
  | "auth.account_deleted"
  | "auth.register"
  // Privacy / DPDP Act 2023
  | "privacy.consent_recorded"
  | "privacy.consent_withdrawn"
  | "privacy.data_exported"
  | "privacy.correction_requested";

interface AuditEntry {
  event: AuditEventType;
  userId?: string;
  emailDomain?: string;   // domain portion only — never the full address
  ip?: string;
  userAgent?: string;
  detail?: Record<string, unknown>;
  timestamp: string;
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  return at > -1 ? `***@${email.slice(at + 1)}` : "***";
}

export function auditLog(
  event: AuditEventType,
  opts: {
    userId?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    detail?: Record<string, unknown>;
  } = {}
): void {
  const entry: AuditEntry = {
    event,
    timestamp: new Date().toISOString(),
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.email ? { emailDomain: maskEmail(opts.email) } : {}),
    ...(opts.ip ? { ip: opts.ip } : {}),
    ...(opts.userAgent ? { userAgent: opts.userAgent } : {}),
    ...(opts.detail ? { detail: opts.detail } : {}),
  };

  // Single-line JSON to stdout — safe for structured log aggregators
  process.stdout.write(JSON.stringify(entry) + "\n");
}
