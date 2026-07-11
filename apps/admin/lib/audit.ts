import { dbPool } from "./db";

/**
 * Record an admin action. Best-effort: a logging failure must never break
 * the action itself.
 *
 * Writes into `admin_audit_log`, which is owned by user-svc's Prisma schema
 * (model AdminAuditLog — adminEmail/action/targetType/targetId/reason/detail).
 * The table is created by `prisma db push` in user-svc; do not create it here.
 */
export async function writeAudit(entry: {
  userId?: string | null;
  action: string;
  reason?: string | null;
  message?: string | null;
}): Promise<void> {
  try {
    await dbPool.query(
      `INSERT INTO admin_audit_log
         (id, "adminEmail", action, "targetType", "targetId", reason, detail, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW())`,
      [
        "admin-panel",
        entry.action,
        entry.userId ? "user" : "system",
        entry.userId ?? "-",
        entry.reason ?? null,
        entry.message ? JSON.stringify({ message: entry.message }) : null,
      ]
    );
  } catch (e) {
    console.error("Audit write failed:", e);
  }
}
