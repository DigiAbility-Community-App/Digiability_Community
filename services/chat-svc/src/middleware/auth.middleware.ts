// ─────────────────────────────────────────────────────────────
// Auth Middleware — HTTP Routes
// Verifies JWT from Authorization header for REST endpoints.
// WebSocket auth is handled separately in the gateway.
// ─────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.util";
import { AuthenticatedUser } from "../types/common.types";
import { checkSuspended } from "../utils/suspension.util";

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  let payload: AuthenticatedUser;
  try {
    payload = verifyAccessToken(token);
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.message.includes("expired")
        ? "Session expired. Please log in again."
        : "Invalid or malformed token.";

    res.status(401).json({ success: false, message });
    return;
  }

  // Reject every request from a suspended/banned account — runs on every
  // authenticated call, so a ban takes effect on the user's very next request.
  // Fail open on a transient DB error so a suspension-check outage doesn't
  // take down all of chat for every user.
  let suspension: Awaited<ReturnType<typeof checkSuspended>> = null;
  try {
    suspension = await checkSuspended(payload.sub);
  } catch (err) {
    console.error("[auth.middleware] suspension check failed:", err);
  }
  if (suspension) {
    res.status(403).json({
      success: false,
      message: suspension.permanent
        ? "Your account has been permanently suspended."
        : "Your account has been temporarily suspended.",
      ...suspension,
    });
    return;
  }

  req.user = payload;
  next();
}
