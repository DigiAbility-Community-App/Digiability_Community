import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AccessTokenPayload } from "../utils/jwt.util";

// ─────────────────────────────────────────────────────
// Auth Middleware
// Verifies the JWT access token from Authorization header.
// ─────────────────────────────────────────────────────

// Extend Express Request type to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/**
 * Protect routes — verifies Bearer token in Authorization header.
 * Sets req.user on success.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.message.includes("expired")
        ? "Session expired. Please log in again."
        : "Invalid or malformed token.";

    res.status(401).json({ success: false, message });
  }
}
