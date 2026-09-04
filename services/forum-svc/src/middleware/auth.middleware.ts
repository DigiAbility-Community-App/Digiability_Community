import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../models/prisma.client";

export interface AccessTokenPayload {
  sub: string;        // userId
  email: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY;
  if (!key) {
    throw new Error("JWT_PUBLIC_KEY is not set in environment");
  }
  return key.replace(/\\n/g, "\n");
}

/**
 * Protect routes — verifies Bearer token in Authorization header.
 * Sets req.user on success.
 */
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

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, getPublicKey(), {
      algorithms: ["RS256"],
    }) as AccessTokenPayload;
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
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isSuspended: true, suspendedUntil: true, suspensionReason: true },
    });
    const isCurrentlySuspended =
      !!user?.isSuspended && (user.suspendedUntil === null || user.suspendedUntil.getTime() > Date.now());
    if (isCurrentlySuspended) {
      res.status(403).json({
        success: false,
        message:
          user!.suspendedUntil === null
            ? "Your account has been permanently suspended."
            : "Your account has been temporarily suspended.",
        banned: true,
        permanent: user!.suspendedUntil === null,
        suspendedUntil: user!.suspendedUntil ? user!.suspendedUntil.toISOString() : null,
        reason: user!.suspensionReason,
      });
      return;
    }
  } catch (err) {
    console.error("[auth.middleware] suspension check failed:", err);
    // Fail open on a transient DB error.
  }

  req.user = payload;
  next();
}

/**
 * Optional authentication: decodes user if token provided, but doesn't reject if unauthenticated.
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, getPublicKey(), {
      algorithms: ["RS256"],
    }) as AccessTokenPayload;
    req.user = payload;
  } catch {
    // Fail silently on invalid token for optional auth
  }
  next();
}
