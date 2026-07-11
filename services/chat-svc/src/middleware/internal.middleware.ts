import { Request, Response, NextFunction } from "express";

// ─────────────────────────────────────────────────────────────
// Internal API Middleware
// Guards endpoints called only by trusted services (e.g. user-svc).
//
// Two-layer protection:
//   1. Shared secret  — x-internal-secret must match INTERNAL_API_SECRET.
//   2. Timestamp      — x-internal-ts must be within ±30 seconds of now,
//                       preventing replay of captured valid requests.
//
// These routes must never be exposed to the public internet.
// In Docker Compose all services share a private network; in production
// place behind a VPC or service-mesh policy that restricts callers.
// ─────────────────────────────────────────────────────────────

const TIMESTAMP_TOLERANCE_MS = 30_000;

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

  // Replay protection: reject requests whose timestamp is too old or too far in the future
  const tsHeader = req.headers["x-internal-ts"];
  if (!tsHeader || typeof tsHeader !== "string") {
    res.status(400).json({ success: false, message: "Missing x-internal-ts header." });
    return;
  }

  const ts = parseInt(tsHeader, 10);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) {
    res.status(400).json({ success: false, message: "Request timestamp out of range." });
    return;
  }

  next();
}
