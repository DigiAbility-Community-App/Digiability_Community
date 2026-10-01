import { Request, Response } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware";
import {
  createGrievance,
  listMyGrievances,
  listGrievancesForAdmin,
  acknowledgeGrievance,
  resolveGrievance,
  grievanceSlaSummary,
  GRIEVANCE_CATEGORIES,
} from "../services/grievance.service";
import prisma from "../models/prisma.client";
import { auditLog } from "../services/audit.service";

// ─────────────────────────────────────────────────────
// Grievance Controller — IT Rules 2021 Rule 3(2)
//
// User-facing routes are mounted under /api/grievances (authenticated).
// Admin routes are under /api/moderation/grievances (internal secret only).
// ─────────────────────────────────────────────────────

// ── POST /api/grievances ──────────────────────────────
export const submitGrievance = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!account) throw createError("Account not found", 404);

  const { category, subject, body, contactEmail } = req.body as {
    category?: string;
    subject?: string;
    body?: string;
    contactEmail?: string;
  };

  const ticket = await createGrievance(userId, contactEmail?.trim() || account.email, {
    category: category ?? "",
    subject: subject ?? "",
    body: body ?? "",
  });

  auditLog("privacy.grievance_received", {
    userId,
    detail: { referenceCode: ticket.referenceCode, category: ticket.category },
  });

  res.status(201).json({
    success: true,
    // The commitment published in Terms §15 — stated back so the complainant
    // knows what to expect and by when.
    message:
      "We've received your complaint. We'll acknowledge it within 24 hours and aim to resolve it within 15 days.",
    data: {
      referenceCode: ticket.referenceCode,
      receivedAt: ticket.receivedAt.toISOString(),
    },
  });
});

// ── GET /api/grievances ───────────────────────────────
export const listOwnGrievances = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const grievances = await listMyGrievances(userId);
  res.status(200).json({ success: true, data: { grievances } });
});

// ── GET /api/grievances/categories ────────────────────
export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { categories: GRIEVANCE_CATEGORIES } });
});

// ── GET /api/moderation/grievances (internal) ─────────
export const adminListGrievances = asyncHandler(async (req: Request, res: Response) => {
  const { status, limit, offset } = req.query;
  const result = await listGrievancesForAdmin({
    status: status ? String(status) : undefined,
    limit: limit ? parseInt(String(limit), 10) : undefined,
    offset: offset ? parseInt(String(offset), 10) : undefined,
  });
  const summary = await grievanceSlaSummary();
  res.status(200).json({ success: true, data: { ...result, summary } });
});

// ── PATCH /api/moderation/grievances/:id (internal) ───
export const adminUpdateGrievance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, adminEmail, resolutionNote } = req.body as {
    action?: string;
    adminEmail?: string;
    resolutionNote?: string;
  };

  if (!adminEmail) {
    throw createError("adminEmail is required so the action is attributable.", 400);
  }

  if (action === "acknowledge") {
    const ticket = await acknowledgeGrievance(id, adminEmail);
    res.status(200).json({ success: true, data: { ticket } });
    return;
  }

  if (action === "resolve") {
    const ticket = await resolveGrievance(id, adminEmail, resolutionNote ?? "");
    res.status(200).json({ success: true, data: { ticket } });
    return;
  }

  throw createError("action must be 'acknowledge' or 'resolve'.", 400);
});
