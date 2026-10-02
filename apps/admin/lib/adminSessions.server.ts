// Server-side admin sessions — what makes logout actually end a session.
//
// The admin token used to be a self-contained JWT: logout only cleared the
// cookie, so a copied cookie kept working until its deadline. Every token now
// carries a `sid` naming a row here, and lib/auth rejects the token once that
// row is revoked or past expiresAt.
//
// Server-only (uses `pg`). middleware.ts runs on the edge and cannot import
// this, so it still checks the signature only; every piece of data goes
// through an API route, which checks here.

import { randomUUID } from "crypto";
import { dbPool } from "./db";

/**
 * How long an "is this session active?" answer is reused in-process. A
 * revocation is seen immediately by the instance that performed it (its cache
 * entry is dropped) and within this window by any other instance.
 */
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 1_000;

const cache = new Map<string, { active: boolean; checkedAt: number }>();

let tableReady = false;

// Mirrors model AdminSession in services/user-svc/prisma/schema.prisma (and the
// forum-svc stub) and migration 20261002030000_add_admin_sessions. Kept here
// too, like admin_login_attempts, so a database that missed the migration
// can't take the admin login down.
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id              TEXT PRIMARY KEY,
      email           TEXT NOT NULL,
      remember        BOOLEAN NOT NULL DEFAULT false,
      "userAgent"     VARCHAR(255),
      "ipAddress"     TEXT,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "lastSeenAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "expiresAt"     TIMESTAMPTZ NOT NULL,
      "revokedAt"     TIMESTAMPTZ,
      "revokedReason" TEXT
    );
  `);
  await dbPool.query(
    `CREATE INDEX IF NOT EXISTS admin_sessions_email_idx ON admin_sessions (email)`
  );
  tableReady = true;
}

function cacheVerdict(sid: string, active: boolean): void {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
  cache.set(sid, { active, checkedAt: Date.now() });
}

/** Start a session for a successful login. Returns its id (the `sid` claim). */
export async function createAdminSession(input: {
  email: string;
  remember: boolean;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}): Promise<string> {
  await ensureTable();
  const id = randomUUID();
  await dbPool.query(
    `INSERT INTO admin_sessions (id, email, remember, "userAgent", "ipAddress", "expiresAt")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      input.email.toLowerCase(),
      input.remember,
      input.userAgent?.slice(0, 255) ?? null,
      input.ipAddress,
      input.expiresAt,
    ]
  );
  cacheVerdict(id, true);

  // Housekeeping, best-effort: rows long past their deadline serve no purpose.
  dbPool
    .query(`DELETE FROM admin_sessions WHERE "expiresAt" < NOW() - INTERVAL '30 days'`)
    .catch((e) => console.error("[adminSessions] prune failed:", e));

  return id;
}

/**
 * True if the session exists, is not revoked and is not past its deadline.
 *
 * Fails CLOSED on a database error — unlike the login rate limiter. Every
 * admin action needs the database anyway, so this only refuses requests that
 * could not have succeeded, and never lets a revoked session through.
 */
export async function isAdminSessionActive(sid: unknown): Promise<boolean> {
  if (typeof sid !== "string" || sid.length === 0) return false;

  const hit = cache.get(sid);
  if (hit && Date.now() - hit.checkedAt < CACHE_TTL_MS) return hit.active;

  try {
    await ensureTable();
    const result = await dbPool.query(
      `SELECT 1 FROM admin_sessions
        WHERE id = $1 AND "revokedAt" IS NULL AND "expiresAt" > NOW()`,
      [sid]
    );
    const active = result.rows.length > 0;
    cacheVerdict(sid, active);
    return active;
  } catch (e) {
    console.error("[adminSessions] session check failed, rejecting:", e);
    return false;
  }
}

/** Record activity and move the session's deadline (sliding renewal). */
export async function touchAdminSession(sid: string, expiresAt: Date): Promise<void> {
  try {
    await ensureTable();
    await dbPool.query(
      `UPDATE admin_sessions SET "lastSeenAt" = NOW(), "expiresAt" = $2
        WHERE id = $1 AND "revokedAt" IS NULL`,
      [sid, expiresAt]
    );
  } catch (e) {
    console.error("[adminSessions] touch failed:", e);
  }
}

/** End one session (logout). */
export async function revokeAdminSession(sid: unknown, reason: string): Promise<void> {
  if (typeof sid !== "string" || sid.length === 0) return;
  cacheVerdict(sid, false);
  await ensureTable();
  await dbPool.query(
    `UPDATE admin_sessions SET "revokedAt" = NOW(), "revokedReason" = $2
      WHERE id = $1 AND "revokedAt" IS NULL`,
    [sid, reason]
  );
}

/** End every session for an admin ("sign out of all devices"). Returns how many. */
export async function revokeAllAdminSessions(email: string, reason: string): Promise<number> {
  await ensureTable();
  const result = await dbPool.query<{ id: string }>(
    `UPDATE admin_sessions SET "revokedAt" = NOW(), "revokedReason" = $2
      WHERE email = $1 AND "revokedAt" IS NULL
      RETURNING id`,
    [email.toLowerCase(), reason]
  );
  for (const row of result.rows) cacheVerdict(row.id, false);
  return result.rowCount ?? 0;
}
