import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";

// ─────────────────────────────────────────────────────
// JWT Utility (RS256 — asymmetric signing)
// Private key: signs tokens (server only)
// Public key:  verifies tokens (can be shared with other services)
// ─────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;        // userId
  email: string;
  iat?: number;
  exp?: number;
}

function getPrivateKey(): string {
  const key = process.env.JWT_PRIVATE_KEY;
  if (!key) throw new Error("JWT_PRIVATE_KEY is not set in environment");
  // Support both literal \n and actual line breaks
  return key.replace(/\\n/g, "\n");
}

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) throw new Error("JWT_PUBLIC_KEY is not set in environment");
  return key.replace(/\\n/g, "\n");
}

/**
 * Sign an access token (RS256, short-lived: 15m default).
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    algorithm: "RS256",
    expiresIn: (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) ?? "15m",
  };
  return jwt.sign(payload, getPrivateKey(), options);
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
 * Decode a token WITHOUT verifying (useful for debugging only — do not trust the payload).
 */
export function decodeToken(token: string): JwtPayload | null {
  return jwt.decode(token) as JwtPayload | null;
}
