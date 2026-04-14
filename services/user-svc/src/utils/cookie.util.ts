import { Response } from "express";

const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

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
