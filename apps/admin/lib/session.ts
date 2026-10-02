// ─────────────────────────────────────────────────────────────
// Admin session policy — one place so the login route, middleware,
// renewal endpoint and client-side idle timer can't drift apart.
//
// Two kinds of session:
//   • Normal — the JWT's `exp` is the IDLE deadline and slides forward while
//     the admin is active; `abs` is a hard ceiling set at login that sliding
//     can never push past. The cookie is a SESSION cookie (no maxAge), so
//     closing the browser ends it.
//   • "Keep me signed in" — `exp` = `abs` = login + REMEMBER_ME_DAYS, with no
//     idle window, and a persistent cookie of the same length. It used to
//     get the normal 2h/12h token inside a 7-day cookie, so the admin was
//     logged out anyway while the browser kept a dead cookie.
// Both are backed by a row in admin_sessions (`sid`), so logout and
// "sign out of all devices" end them immediately.
// ─────────────────────────────────────────────────────────────

/**
 * Idle window for normal sessions when the Security setting is missing,
 * unreadable or still an old default.
 *
 * 30 minutes, then 2 hours, both proved too aggressive — an admin working
 * through a moderation queue or writing a long reason kept getting the
 * "Still there?" warning mid-task. 8 hours covers a working day, still inside
 * the 12-hour absolute ceiling below.
 */
export const DEFAULT_IDLE_MINUTES = 480;

/** Hard ceiling on one normal login, regardless of continuous activity. */
export const ABSOLUTE_SESSION_HOURS = 12;

/** How long a "Keep me signed in" session lasts — token and cookie both. */
export const REMEMBER_ME_DAYS = 7;

/** Warn this long before the idle deadline so a working admin can stay in. */
export const IDLE_WARNING_SECONDS = 60;

export const SESSION_COOKIE = "admin-session";

export interface AdminSessionPayload {
  email: string;
  role: "admin";
  /** Idle deadline (unix seconds) — slides on activity. */
  exp: number;
  /** Absolute deadline (unix seconds) — fixed at login. */
  abs: number;
  /** "Keep me signed in": fixed REMEMBER_ME_DAYS lifetime, no idle window. */
  remember?: boolean;
  /** admin_sessions row id — revoking it ends the session everywhere. */
  sid: string;
}

/**
 * Clamped so a bad/hostile settings value can't disable the timeout. The
 * Security settings column default is 1440 (a full day), which is far too
 * long for an idle window — treat anything over the max as the max.
 */
export function normalizeIdleMinutes(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_IDLE_MINUTES;
  return Math.min(Math.max(Math.round(n), 1), 8 * 60);
}

/**
 * Cookie options. Omitting maxAge/expires yields a session cookie, which is
 * what makes closing the browser log the admin out.
 */
export function sessionCookieOptions(opts: { isHttps: boolean; remember: boolean }) {
  return {
    path: "/",
    httpOnly: true,
    secure: opts.isHttps,
    sameSite: "strict" as const,
    ...(opts.remember ? { maxAge: REMEMBER_ME_DAYS * 24 * 60 * 60 } : {}),
  };
}

/** True when a request arrived over TLS (directly or via a terminating proxy). */
export function requestIsHttps(request: { headers: Headers; url: string }): boolean {
  return (
    request.headers.get("x-forwarded-proto") === "https" ||
    new URL(request.url).protocol === "https:"
  );
}
