import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import { submitReport } from "../services/report.service";

// ─────────────────────────────────────────────────────
// Report Controller
// ─────────────────────────────────────────────────────

// ── POST /api/reports ─────────────────────────────────
export const createReport = asyncHandler(async (req: Request, res: Response) => {
  const reporterId = req.user!.sub;
  const { id, alreadyReported } = await submitReport(reporterId, req.body);

  res.status(alreadyReported ? 200 : 201).json({
    success: true,
    message: alreadyReported
      ? "You have already reported this content."
      : "Report submitted. Our moderation team will review it.",
    data: { id },
  });
});
