import { dbPool } from "./db";

// Ensures the audit table exists. Runs at most once per process.
let ensured = false;
export async function ensureAuditTable(): Promise<void> {
  if (ensured) return;
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" TEXT,
      action TEXT NOT NULL,
      reason TEXT,
      message TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  ensured = true;
}

/**
 * Record an admin action. Best-effort: a logging failure must never break
 * the action itself, but (unlike before) the table is created on demand so
 * writes actually land.
 */
export async function writeAudit(entry: {
  userId?: string | null;
  action: string;
  reason?: string | null;
  message?: string | null;
}): Promise<void> {
  try {
    await ensureAuditTable();
    await dbPool.query(
      `INSERT INTO admin_audit_log ("userId", action, reason, message, "createdAt")
       VALUES ($1, $2, $3, $4, NOW())`,
      [entry.userId ?? null, entry.action, entry.reason ?? null, entry.message ?? null]
    );
  } catch (e) {
    console.error("Audit write failed:", e);
  }
}
