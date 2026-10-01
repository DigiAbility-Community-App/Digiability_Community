import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import {
  recordGuardianAttestation,
  listGuardianAttestations,
  revokeGuardianAttestation,
} from "../services/guardian.service";

// ─────────────────────────────────────────────────────
// Guardian Controller — DPDP Act 2023 §9
// Mounted under /api/auth/privacy/guardian.
// All routes require a valid access token.
// ─────────────────────────────────────────────────────

// ── POST /api/auth/privacy/guardian ───────────────────
export const createAttestation = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const ip = req.ip;

  const attestation = await recordGuardianAttestation(userId, req.body, ip);

  res.status(201).json({
    success: true,
    message: "Thank you. We've recorded your confirmation.",
    data: { attestation },
  });
});

// ── GET /api/auth/privacy/guardian ────────────────────
export const listAttestations = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  const attestations = await listGuardianAttestations(userId);
  res.status(200).json({ success: true, data: { attestations } });
});

// ── DELETE /api/auth/privacy/guardian/:id ─────────────
export const revokeAttestation = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;
  await revokeGuardianAttestation(userId, req.params.id);
  res.status(200).json({ success: true, message: "Confirmation withdrawn.", data: {} });
});
