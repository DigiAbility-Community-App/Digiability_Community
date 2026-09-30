import { dbPool } from "./db";

/**
 * Rate limiting and lockout for the admin login.
 *
 * The admin login had none. Combined with `data/credentials.json` having been
 * committed to git (bcrypt cost 10, offline-crackable), that meant a cracked
 * hash could be used against an endpoint that would accept unlimited guesses.
 *
 * Backed by Postgres rather than memory on purpose: the admin panel is
 * deployed to Vercel, where each request may hit a different lambda with its
 * own heap, so an in-memory counter would reset constantly and enforce nothing.
 *
 * Two independent budgets:
 *   • per email — stops one account being ground down
 *   • per IP    — stops one attacker spraying many accounts
 */

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      identifier   TEXT NOT NULL,
      kind         TEXT NOT NULL,
      succeeded    BOOLEAN NOT NULL DEFAULT false,
      "attemptedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await dbPool.query(
    `CREATE INDEX IF NOT EXISTS admin_login_attempts_lookup
       ON admin_login_attempts (identifier, "attemptedAt" DESC)`
  );
  tableReady = true;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Minutes until the caller may try again. Only set when blocked. */
  retryAfterMinutes?: number;
}

/**
 * Check whether this login attempt may proceed.
 *
 * Fails OPEN on a database error: locking every admin out of the panel because
 * the rate-limit table is unreachable would be a worse outcome than briefly
 * losing the limit. The failure is logged so it is not silent.
 */
export async function checkLoginAllowed(
  email: string,
  ip: string | null
): Promise<RateLimitVerdict> {
  try {
    await ensureTable();

    const result = await dbPool.query<{ kind: string; failures: string }>(
      `SELECT kind, COUNT(*) AS failures
         FROM admin_login_attempts
        WHERE succeeded = false
          AND "attemptedAt" > NOW() - ($3 || ' minutes')::interval
          AND ((kind = 'email' AND identifier = $1)
            OR (kind = 'ip'    AND identifier = $2))
        GROUP BY kind`,
      [email.toLowerCase(), ip ?? "unknown", String(WINDOW_MINUTES)]
    );

    for (const row of result.rows) {
      const failures = Number(row.failures);
      const limit = row.kind === "email" ? MAX_FAILURES_PER_EMAIL : MAX_FAILURES_PER_IP;
      if (failures >= limit) {
        return { allowed: false, retryAfterMinutes: WINDOW_MINUTES };
      }
    }

    return { allowed: true };
  } catch (e) {
    console.error("[loginRateLimit] check failed, allowing the attempt:", e);
    return { allowed: true };
  }
}

/** Record the outcome of a login attempt. Best-effort. */
export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  succeeded: boolean
): Promise<void> {
  try {
    await ensureTable();
    await dbPool.query(
      `INSERT INTO admin_login_attempts (identifier, kind, succeeded)
       VALUES ($1, 'email', $3), ($2, 'ip', $3)`,
      [email.toLowerCase(), ip ?? "unknown", succeeded]
    );

    // A successful login clears that account's failure streak, so an admin who
    // mistypes twice then gets it right doesn't carry the count forward.
    if (succeeded) {
      await dbPool.query(
        `DELETE FROM admin_login_attempts
          WHERE kind = 'email' AND identifier = $1 AND succeeded = false`,
        [email.toLowerCase()]
      );
    }
  } catch (e) {
    console.error("[loginRateLimit] could not record attempt:", e);
  }
}

/** Housekeeping: drop attempts well past the window. */
export async function pruneLoginAttempts(): Promise<void> {
  try {
    await ensureTable();
    await dbPool.query(
      `DELETE FROM admin_login_attempts WHERE "attemptedAt" < NOW() - INTERVAL '7 days'`
    );
  } catch {
    // Non-fatal.
  }
}
