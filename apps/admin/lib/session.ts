// ─────────────────────────────────────────────────────────────
// Admin session policy — one place so the login route, middleware,
// renewal endpoint and client-side idle timer can't drift apart.
//
// Model: the JWT's `exp` is the IDLE deadline and slides forward while
// the admin is active; `abs` is a hard ceiling set at login that sliding
// can never push past. The cookie is a SESSION cookie (no maxAge) unless
// the admin ticked "Remember me", so closing the browser ends the session.
// ─────────────────────────────────────────────────────────────

/** Idle window used when the Security setting is missing or unreadable. */
export const DEFAULT_IDLE_MINUTES = 30;

/** Hard ceiling on one login, regardless of continuous activity. */
export const ABSOLUTE_SESSION_HOURS = 12;

/** How long a "Remember me" cookie survives browser restarts. */
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
  /** Whether this session opted into surviving a browser restart. */
  remember?: boolean;
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
