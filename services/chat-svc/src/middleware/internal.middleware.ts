import { Request, Response, NextFunction } from "express";

// ─────────────────────────────────────────────────────────────
// Internal API Middleware
// Guards endpoints that are only called by other services
// (e.g. user-svc calling to clean up memberships on account deletion).
// Validates a shared secret passed in the x-internal-secret header.
// Never expose these routes to the public internet.
// ─────────────────────────────────────────────────────────────

export function internalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.INTERNAL_API_SECRET;

  if (!secret) {
    res.status(503).json({ success: false, message: "Internal API not configured." });
    return;
  }

  if (req.headers["x-internal-secret"] !== secret) {
    res.status(401).json({ success: false, message: "Unauthorized." });
    return;
  }

  next();
}
