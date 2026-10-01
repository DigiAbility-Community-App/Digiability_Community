import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AccessTokenPayload } from "../utils/jwt.util";
import { isSessionActive } from "../services/session.service";
import prisma from "../models/prisma.client";
import { isCurrentlySuspended } from "../utils/suspension.util";

// ─────────────────────────────────────────────────────
// Auth Middleware
// 1. Verifies the RS256 access token from Authorization header.
// 2. Checks the token's session (`sid`) is still active — logout, logout-all,
//    password reset, refresh-token reuse and account deletion revoke it, and
//    the token stops working on its very next request (VAPT M-003).
// 3. Confirms the account has not been soft-deleted.
// ─────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
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

  const token = authHeader.split(" ")[1]?.trim();
  if (!token) {
    res.status(401).json({ success: false, message: "Authentication required. Please log in." });
    return;
  }

  let payload: AccessTokenPayload;
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

  // Tokens minted before sessions existed carry no sid. Rejecting them is
  // safe: clients refresh on 401, and refresh issues a session-bound token.
  if (!payload.sid) {
    res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    return;
  }

  // Session check — the token may belong to a session that was revoked
  // (logout etc.) even though the token itself hasn't expired.
  if (!(await isSessionActive(payload.sid))) {
    res.status(401).json({ success: false, message: "Session has been revoked. Please log in again." });
    return;
  }

  // Guard against soft-deleted accounts (single indexed PK lookup)
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      deletedAt: true,
      isSuspended: true,
      suspendedUntil: true,
      suspensionReason: true,
    },
  });

  if (!user || user.deletedAt !== null) {
    res.status(401).json({
      success: false,
      message: "Account not found or has been deleted.",
    });
    return;
  }

  // Reject every request from a suspended/banned account — this runs on
  // every authenticated call, so a ban takes effect on the user's very next
  // request rather than waiting for their token to expire.
  if (isCurrentlySuspended(user)) {
    res.status(403).json({
      success: false,
      message:
        user.suspendedUntil === null
          ? "Your account has been permanently suspended."
          : "Your account has been temporarily suspended.",
      banned: true,
      permanent: user.suspendedUntil === null,
      suspendedUntil: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
      reason: user.suspensionReason,
    });
    return;
  }

  req.user = payload;
  next();
}
