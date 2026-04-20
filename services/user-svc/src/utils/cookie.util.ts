import { Response } from "express";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

// ─────────────────────────────────────────────────────
// Cookie Utility
// ─────────────────────────────────────────────────────

/**
 * Attach the refresh token as an HTTP-only secure cookie.
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  const expiresInDays = parseInt(
    process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? "30",
    10
  );

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,                                     // Not accessible via JS (XSS protection)
    secure: process.env.NODE_ENV === "production",      // HTTPS only in prod
    sameSite: "strict",                                  // CSRF protection
    maxAge: expiresInDays * 24 * 60 * 60 * 1000,       // ms
    path: "/",
  });
}

/**
 * Expose the raw refresh token for native clients that cannot reliably
 * read or persist HttpOnly cookies.
 */
export function setRefreshTokenHeader(res: Response, token: string): void {
  res.setHeader("x-refresh-token", token);
}

/**
 * Clear the refresh token cookie (on logout).
 */
export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

/**
 * Read the refresh token from the incoming request cookie.
 */
export function getRefreshTokenFromCookie(
  cookies: Record<string, string>
): string | undefined {
  return cookies[REFRESH_TOKEN_COOKIE_NAME];
}

/**
 * Read the raw refresh token from Authorization: Bearer <token>.
 * Used by native clients when cookies are not available.
 */
export function getRefreshTokenFromAuthHeader(
  authHeader?: string
): string | undefined {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return undefined;
  }

  return authHeader.slice("Bearer ".length).trim() || undefined;
}
