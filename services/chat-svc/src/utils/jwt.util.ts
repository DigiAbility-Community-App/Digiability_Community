// ─────────────────────────────────────────────────────────────
// JWT Utility — Verification Only
// chat-svc only verifies tokens issued by user-svc.
// It never signs tokens (no private key needed).
// ─────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthenticatedUser } from "../types/common.types";

/**
 * Verify an RS256 access token using the shared public key.
 * Returns the decoded payload if valid, throws if invalid/expired.
 */
export function verifyAccessToken(token: string): AuthenticatedUser {
  const decoded = jwt.verify(token, env.JWT_PUBLIC_KEY, {
    algorithms: ["RS256"],
  }) as AuthenticatedUser;
  return decoded;
}

/**
 * Attempt to verify without throwing — returns null on failure.
 * Useful for WebSocket upgrade where we want to reject gracefully.
 */
export function tryVerifyAccessToken(token: string): AuthenticatedUser | null {
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
