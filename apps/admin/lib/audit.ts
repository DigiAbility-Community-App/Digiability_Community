import { dbPool } from "./db";

/**
 * Record an admin action. Best-effort: a logging failure must never break
 * the action itself.
 *
 * Writes into `admin_audit_log`, which is owned by user-svc's Prisma schema
 * (model AdminAuditLog — adminEmail/action/targetType/targetId/reason/detail/
 * ipAddress). The table is created by `prisma db push` in user-svc; do not
 * create it here.
 *
 * `adminEmail` is REQUIRED. It previously did not exist as a parameter at all —
 * the literal string "admin-panel" was hardcoded into every row, so the log
 * could not answer "which admin did this", which is the only question an audit
 * trail exists to answer. Making it required means the type checker, not a
 * reviewer, catches a call site that forgets the actor.
 *
 * Pass the email from `getAdminSession(request)` in lib/auth.
 */
export async function writeAudit(entry: {
  /** Email of the acting admin, from getAdminSession(). */
  adminEmail: string | null | undefined;
  action: string;
  /** What kind of thing was acted on. Defaults from userId when omitted. */
  targetType?: string | null;
  /** Id of the thing acted on. Defaults from userId when omitted. */
  targetId?: string | null;
  userId?: string | null;
  reason?: string | null;
  message?: string | null;
  /** Truncated client IP, from getRequestIp(). */
  ipAddress?: string | null;
}): Promise<string | null> {
  try {
    // A missing actor is a bug, not a normal state — record it distinguishably
    // rather than silently attributing the action to a plausible-looking value.
    const actor = entry.adminEmail ?? "unknown-admin";

    // Returns the row id so an enforcement notice can reference the decision
    // that produced it — that link is what makes an appeal reviewable by
    // someone other than the admin who decided.
    const result = await dbPool.query<{ id: string }>(
      `INSERT INTO admin_audit_log
         (id, "adminEmail", action, "targetType", "targetId", reason, detail, "ipAddress", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [
        actor,
        entry.action,
        entry.targetType ?? (entry.userId ? "user" : "system"),
        entry.targetId ?? entry.userId ?? "-",
        entry.reason ?? null,
        entry.message ? JSON.stringify({ message: entry.message }) : null,
        entry.ipAddress ?? null,
      ]
    );
    return result.rows[0]?.id ?? null;
  } catch (e) {
    console.error("Audit write failed:", e);
    return null;
  }
}
