import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware";
import { getRedis } from "../config/redis";
import prisma from "../models/prisma.client";
import {
  createKeyword,
  listKeywords,
  updateKeyword,
  deleteKeyword,
} from "../services/keyword.service";
import { KeywordAction, KeywordCategory, KeywordMatchType, KeywordSeverity, FlagStatus, ReportStatus } from "../generated/client";

// ─────────────────────────────────────────────────────
// Moderation Routes (user-svc)
// Base path: /api/moderation  (mounted in index.ts)
//
// /stats             — public, no auth (aggregate counters only)
// /keywords/*        — protected by INTERNAL_API_SECRET (admin panel only)
// ─────────────────────────────────────────────────────

const router = Router();

// ─── Internal auth middleware ──────────────────────────
// Protects keyword CRUD from public access.
function internalOnly(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || req.headers["x-internal-secret"] !== secret) {
    res.status(401).json({ success: false, message: "Unauthorized." });
    return;
  }
  next();
}

// ─── GET /api/moderation/stats ─────────────────────────
router.get(
  "/stats",
  asyncHandler(async (_req: Request, res: Response) => {
    const today = new Date().toISOString().slice(0, 10);
    const redis = getRedis();

    const [chatBlocked, forumBlocked] = await Promise.all([
      redis.get(`mod:blocked:chat:${today}`),
      redis.get(`mod:blocked:forum:${today}`),
    ]);

    res.status(200).json({
      success: true,
      data: {
        date: today,
        blockedToday: {
          chat: parseInt(chatBlocked ?? "0", 10),
          forum: parseInt(forumBlocked ?? "0", 10),
          total: parseInt(chatBlocked ?? "0", 10) + parseInt(forumBlocked ?? "0", 10),
        },
      },
    });
  })
);

// ─── GET /api/moderation/keywords ─────────────────────
router.get(
  "/keywords",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { category, isActive } = req.query;
    const keywords = await listKeywords({
      category: typeof category === "string" ? category : undefined,
      isActive: isActive === "false" ? false : isActive === "true" ? true : undefined,
    });
    res.status(200).json({ success: true, data: { keywords } });
  })
);

// ─── POST /api/moderation/keywords ────────────────────
router.post(
  "/keywords",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { phrase, severity, action, category, matchType, createdBy } = req.body as {
      phrase?: string;
      severity?: string;
      action?: string;
      category?: string;
      matchType?: string;
      createdBy?: string;
    };

    if (!phrase || typeof phrase !== "string" || phrase.trim().length === 0) {
      throw createError("phrase is required.", 400);
    }
    if (phrase.trim().length > 200) {
      throw createError("phrase cannot exceed 200 characters.", 400);
    }

    const VALID_SEVERITY = Object.values(KeywordSeverity) as string[];
    const VALID_ACTION = Object.values(KeywordAction) as string[];
    const VALID_CATEGORY = Object.values(KeywordCategory) as string[];
    const VALID_MATCH = Object.values(KeywordMatchType) as string[];

    if (severity && !VALID_SEVERITY.includes(severity)) throw createError(`Invalid severity. Valid: ${VALID_SEVERITY.join(", ")}`, 400);
    if (action && !VALID_ACTION.includes(action)) throw createError(`Invalid action. Valid: ${VALID_ACTION.join(", ")}`, 400);
    if (category && !VALID_CATEGORY.includes(category)) throw createError(`Invalid category. Valid: ${VALID_CATEGORY.join(", ")}`, 400);
    if (matchType && !VALID_MATCH.includes(matchType)) throw createError(`Invalid matchType. Valid: ${VALID_MATCH.join(", ")}`, 400);

    const keyword = await createKeyword({
      phrase,
      severity: severity as KeywordSeverity | undefined,
      action: action as KeywordAction | undefined,
      category: category as KeywordCategory | undefined,
      matchType: matchType as KeywordMatchType | undefined,
      createdBy,
    });

    res.status(201).json({ success: true, data: { keyword } });
  })
);

// ─── PATCH /api/moderation/keywords/:id ───────────────
router.patch(
  "/keywords/:id",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { severity, action, category, matchType, isActive, phrase } = req.body as Record<string, string | boolean | undefined>;

    const keyword = await updateKeyword(id, {
      ...(phrase !== undefined ? { phrase: String(phrase) } : {}),
      ...(severity !== undefined ? { severity: severity as KeywordSeverity } : {}),
      ...(action !== undefined ? { action: action as KeywordAction } : {}),
      ...(category !== undefined ? { category: category as KeywordCategory } : {}),
      ...(matchType !== undefined ? { matchType: matchType as KeywordMatchType } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    });

    res.status(200).json({ success: true, data: { keyword } });
  })
);

// ─── DELETE /api/moderation/keywords/:id ──────────────
router.delete(
  "/keywords/:id",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await deleteKeyword(id);
    res.status(200).json({ success: true, message: result.message });
  })
);

// ─── GET /api/moderation/flags ─────────────────────────
// Returns recent AI classification flags for admin review.
// Protected by INTERNAL_API_SECRET so only the admin panel reads it.
router.get(
  "/flags",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, limit: limitStr, offset: offsetStr } = req.query;
    const limit = Math.min(parseInt(String(limitStr ?? "50"), 10), 100);
    const offset = parseInt(String(offsetStr ?? "0"), 10);

    const flags = await prisma.moderationFlag.findMany({
      where: status ? { status: status as FlagStatus } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
    const total = await prisma.moderationFlag.count({
      where: status ? { status: status as FlagStatus } : undefined,
    });

    res.status(200).json({ success: true, data: { flags, total } });
  })
);

// ─── PATCH /api/moderation/flags/:id ──────────────────
// Update flag status (reviewed / actioned / dismissed).
router.patch(
  "/flags/:id",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, reviewedBy } = req.body as { status?: string; reviewedBy?: string };

    const VALID_STATUS = Object.values(FlagStatus) as string[];
    if (status && !VALID_STATUS.includes(status)) {
      throw createError(`Invalid status. Valid: ${VALID_STATUS.join(", ")}`, 400);
    }

    const flag = await prisma.moderationFlag.update({
      where: { id },
      data: {
        ...(status ? { status: status as FlagStatus } : {}),
        ...(reviewedBy ? { reviewedBy } : {}),
        ...(status && status !== FlagStatus.PENDING ? { reviewedAt: new Date() } : {}),
      },
    });

    res.status(200).json({ success: true, data: { flag } });
  })
);

// ─── GET /api/moderation/reports ──────────────────────
// Lists UserReports for the admin review queue.
router.get(
  "/reports",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, limit: limitStr, offset: offsetStr } = req.query;
    const limit = Math.min(parseInt(String(limitStr ?? "50"), 10), 100);
    const offset = parseInt(String(offsetStr ?? "0"), 10);

    const where = status ? { status: status as ReportStatus } : undefined;

    const [reports, total] = await Promise.all([
      prisma.userReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.userReport.count({ where }),
    ]);

    res.status(200).json({ success: true, data: { reports, total } });
  })
);

// ─── PATCH /api/moderation/reports/:id ────────────────
router.patch(
  "/reports/:id",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, reviewedBy, actionTaken } = req.body as {
      status?: string;
      reviewedBy?: string;
      actionTaken?: string;
    };

    const VALID_STATUS = Object.values(ReportStatus) as string[];
    if (status && !VALID_STATUS.includes(status)) {
      throw createError(`Invalid status. Valid: ${VALID_STATUS.join(", ")}`, 400);
    }

    const report = await prisma.userReport.update({
      where: { id },
      data: {
        ...(status ? { status: status as ReportStatus } : {}),
        ...(reviewedBy ? { reviewedBy } : {}),
        ...(actionTaken !== undefined ? { actionTaken } : {}),
        ...(status && status !== ReportStatus.PENDING ? { reviewedAt: new Date() } : {}),
      },
    });

    res.status(200).json({ success: true, data: { report } });
  })
);

// ─── POST /api/moderation/audit ───────────────────────
// Write an admin audit log entry.
router.post(
  "/audit",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { adminEmail, action, targetType, targetId, reason, detail } = req.body as {
      adminEmail: string;
      action: string;
      targetType: string;
      targetId: string;
      reason?: string;
      detail?: string;
    };

    if (!adminEmail || !action || !targetType || !targetId) {
      throw createError("adminEmail, action, targetType, and targetId are required.", 400);
    }

    const entry = await prisma.adminAuditLog.create({
      data: { adminEmail, action, targetType, targetId, reason, detail },
    });

    res.status(201).json({ success: true, data: { entry } });
  })
);

// ─── GET /api/moderation/audit ────────────────────────
// Returns recent admin actions for the audit log page.
router.get(
  "/audit",
  internalOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit: limitStr, offset: offsetStr } = req.query;
    const limit = Math.min(parseInt(String(limitStr ?? "50"), 10), 200);
    const offset = parseInt(String(offsetStr ?? "0"), 10);

    const [entries, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.adminAuditLog.count(),
    ]);

    res.status(200).json({ success: true, data: { entries, total } });
  })
);

export default router;
