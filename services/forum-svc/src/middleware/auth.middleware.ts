import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
    const payload = jwt.verify(token, getPublicKey(), {
      algorithms: ["RS256"],
    }) as AccessTokenPayload;

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
