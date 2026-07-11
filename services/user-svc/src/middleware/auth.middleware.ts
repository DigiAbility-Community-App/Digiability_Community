import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, AccessTokenPayload } from "../utils/jwt.util";
import { isJtiRevoked } from "../config/redis";
import prisma from "../models/prisma.client";
import { isCurrentlySuspended } from "../utils/suspension.util";

// ─────────────────────────────────────────────────────
// Auth Middleware
// 1. Verifies the RS256 access token from Authorization header.
// 2. Checks the JTI against the Redis revocation blocklist
//    (populated on logout / account deletion).
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

  // Check JTI blocklist — token may have been revoked by logout/deletion
  // even though it hasn't expired yet.
  if (payload.jti) {
    const revoked = await isJtiRevoked(payload.jti).catch(() => false);
    if (revoked) {
      res.status(401).json({ success: false, message: "Session has been revoked. Please log in again." });
      return;
    }
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
