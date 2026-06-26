import prisma from "../models/prisma.client";
import { createError } from "../middleware/error.middleware";
import type { ReportInput } from "../utils/validation.util";

// ─────────────────────────────────────────────────────
// Report Service
// Handles user reports for users, chat messages, and groups.
// Reports land in user_reports; the admin moderation queue
// (Phase 3) reads them from there.
// ─────────────────────────────────────────────────────

// In-process rate limiter: max 10 reports per user per hour.
// Acceptable for launch scale — replace with Redis if volume warrants it.
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

function enforceRateLimit(userId: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    throw createError("Too many reports submitted. Please wait before reporting again.", 429);
  }

  entry.count += 1;
}

export async function submitReport(
  reporterId: string,
  input: ReportInput
): Promise<{ id: string; alreadyReported: boolean }> {
  const { targetType, targetId, reason, details } = input;

  // Prevent self-reporting
  if (targetType === "USER" && targetId === reporterId) {
    throw createError("You cannot report yourself.", 400);
  }

  enforceRateLimit(reporterId);

  // Upsert: silently succeed if this reporter already filed the same report,
  // so idempotent mobile retries don't surface confusing errors to the user.
  const existing = await prisma.userReport.findUnique({
    where: {
      reporterId_targetType_targetId: { reporterId, targetType, targetId },
    },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, alreadyReported: true };
  }

  const report = await prisma.userReport.create({
    data: { reporterId, targetType, targetId, reason, details },
    select: { id: true },
  });

  return { id: report.id, alreadyReported: false };
}
