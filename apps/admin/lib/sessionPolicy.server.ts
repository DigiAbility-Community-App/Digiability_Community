// Server-only: reads the configured idle timeout from Security settings.
// Kept out of lib/session.ts because that module is imported by middleware
// (edge runtime) and by client components, neither of which can use `pg`.

import { dbPool } from "./db";
import { DEFAULT_IDLE_MINUTES, normalizeIdleMinutes } from "./session";

/**
 * `session_timeout_mins` has existed in admin_security_settings all along but
 * was never read by anything — the value an admin saved in Settings → Security
 * had no effect. This is what makes it real.
 *
 * Falls back to the default if the table/row is missing or the query fails, so
 * a settings problem can never leave sessions un-expiring.
 */
export async function getIdleTimeoutMinutes(): Promise<number> {
  try {
    const result = await dbPool.query(
      `SELECT session_timeout_mins FROM admin_security_settings WHERE id = 'default'`
    );
    if (result.rows.length === 0) return DEFAULT_IDLE_MINUTES;
    const stored = result.rows[0].session_timeout_mins;
    // 1440 was the column's old default while nothing read this value, so it
    // reflects no actual decision — don't let a dead default become a 24h idle
    // window. (The security-settings route also migrates it in place, but this
    // doesn't depend on that route having been hit first.)
    if (Number(stored) === 1440) return DEFAULT_IDLE_MINUTES;
    return normalizeIdleMinutes(stored);
  } catch {
    return DEFAULT_IDLE_MINUTES;
  }
}
