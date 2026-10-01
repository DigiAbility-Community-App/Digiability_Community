import crypto from "crypto";
import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";

// ─────────────────────────────────────────────────────
// JWT Utility (RS256 — asymmetric signing)
// Private key: signs tokens (user-svc only)
// Public key:  verifies tokens (shared with chat-svc, forum-svc)
// ─────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;        // userId
  email: string;
  sid: string;        // session id (sessions.id) — revoking the session kills the token
  jti: string;        // unique token id
  iat?: number;
  exp?: number;
}

// Short-lived on purpose: a session revocation is enforced on every request,
// but a short TTL bounds the damage if a token is copied off a device.
export const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRES_IN ?? "10m";

function getPrivateKey(): string {
  const key = process.env.JWT_PRIVATE_KEY;
  if (!key) throw new Error("JWT_PRIVATE_KEY is not set in environment");
  return key.replace(/\\n/g, "\n");
}

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) throw new Error("JWT_PUBLIC_KEY is not set in environment");
  return key.replace(/\\n/g, "\n");
}

/**
 * Sign an access token (RS256, short-lived: 10m default) bound to a session.
 */
export function signAccessToken(payload: Omit<AccessTokenPayload, "jti">): string {
  const jti = crypto.randomUUID();
  const options: SignOptions = {
    algorithm: "RS256",
    expiresIn: ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  };
  return jwt.sign({ ...payload, jti }, getPrivateKey(), options);
}

/**
 * Verify and decode an access token.
 * Throws if token is invalid or expired.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getPublicKey(), {
    algorithms: ["RS256"],
  }) as AccessTokenPayload;
  return decoded;
}

/**
 * Verify the signature but ignore expiry — for logout, which must still work
 * (and still only trust tokens we signed) after the access token has expired.
 */
export function verifyAccessTokenIgnoringExpiry(token: string): AccessTokenPayload {
  return jwt.verify(token, getPublicKey(), {
    algorithms: ["RS256"],
    ignoreExpiration: true,
  }) as AccessTokenPayload;
}

/**
 * Decode a token WITHOUT verifying — for extracting the jti on logout
 * when we need the claim even if the token is already expired.
 */
export function decodeToken(token: string): JwtPayload | null {
  return jwt.decode(token) as JwtPayload | null;
}
