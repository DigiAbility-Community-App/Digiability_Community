import { Request, Response } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware";
import {
  submitAppeal,
  listMyAppeals,
  appealability,
  listAppealsForAdmin,
  decideAppeal,
  claimAppealForReview,
} from "../services/appeal.service";

// ─────────────────────────────────────────────────────
// Appeal Controller — Community Guidelines "Appeals"
//
// User routes:  /api/appeals            (authenticated)
// Admin routes: /api/moderation/appeals (internal secret only)
// ─────────────────────────────────────────────────────

// ── POST /api/appeals ─────────────────────────────────
export const createAppeal = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const { auditLogId, grounds } = req.body as { auditLogId?: string; grounds?: string };

  if (!auditLogId) {
    throw createError("We need to know which decision you're appealing.", 400);
  }

  const appeal = await submitAppeal(userId, { auditLogId, grounds: grounds ?? "" });

  res.status(201).json({
    success: true,
    message:
      "Your appeal has been submitted. We'll review it and respond by the date shown.",
    data: {
      referenceCode: appeal.referenceCode,
      dueBy: appeal.dueBy.toISOString(),
    },
  });
});

// ── GET /api/appeals ──────────────────────────────────
export const listOwnAppeals = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const appeals = await listMyAppeals(userId);
  res.status(200).json({ success: true, data: { appeals } });
});

// ── GET /api/appeals/eligibility/:auditLogId ──────────
// Drives whether the client shows an Appeal button, and what it says.
export const checkAppealability = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const result = await appealability(userId, req.params.auditLogId);
  res.status(200).json({ success: true, data: result });
});

// ── GET /api/moderation/appeals (internal) ────────────
export const adminListAppeals = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;
  const appeals = await listAppealsForAdmin(status ? String(status) : undefined);
  res.status(200).json({ success: true, data: { appeals } });
});

// ── PATCH /api/moderation/appeals/:id (internal) ──────
export const adminDecideAppeal = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { outcome, decisionNote, reviewerEmail } = req.body as {
    outcome?: string;
    decisionNote?: string;
    reviewerEmail?: string;
  };

  if (!reviewerEmail) {
    // Without the reviewer's identity we cannot enforce the published promise
    // that an appeal is decided by someone other than the original decider.
    throw createError("reviewerEmail is required.", 400);
  }
  if (outcome !== "UPHELD" && outcome !== "OVERTURNED" && outcome !== "REJECTED") {
    throw createError("outcome must be UPHELD, OVERTURNED or REJECTED.", 400);
  }

  const appeal = await decideAppeal(id, reviewerEmail, outcome, decisionNote ?? "");
  res.status(200).json({ success: true, data: { appeal } });
});

// ── POST /api/moderation/appeals/:id/claim (internal) ──
export const adminClaimAppeal = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reviewerEmail } = req.body as { reviewerEmail?: string };

  if (!reviewerEmail) {
    throw createError("reviewerEmail is required.", 400);
  }

  const appeal = await claimAppealForReview(id, reviewerEmail);
  res.status(200).json({ success: true, data: { appeal } });
});
