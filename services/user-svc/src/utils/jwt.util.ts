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
  jti: string;        // JWT ID — used for pre-expiry revocation via Redis blocklist
  iat?: number;
  exp?: number;
}

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
 * Sign an access token (RS256, short-lived: 15m default).
 * Includes a jti claim so the token can be added to the revocation blocklist
 * before it expires (e.g. on logout or account deletion).
 */
export function signAccessToken(payload: Omit<AccessTokenPayload, "jti">): string {
  const jti = crypto.randomUUID();
  const options: SignOptions = {
    algorithm: "RS256",
    expiresIn: (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) ?? "15m",
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
 * Decode a token WITHOUT verifying — for extracting the jti on logout
 * when we need the claim even if the token is already expired.
 */
export function decodeToken(token: string): JwtPayload | null {
  return jwt.decode(token) as JwtPayload | null;
}
