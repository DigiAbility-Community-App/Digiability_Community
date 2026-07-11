// ─────────────────────────────────────────────────────
// Privacy Controller — DPDP Act 2023 + GDPR-compatible
//
// Routes are mounted under /api/auth/privacy.
// All routes require a valid access token (authenticate middleware).
// ─────────────────────────────────────────────────────

import { Request, Response } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware";
import {
  recordConsent,
  getUserConsents,
  withdrawConsent,
} from "../services/consent.service";
import { exportUserData } from "../services/data-export.service";
import { auditLog } from "../services/audit.service";
import { ConsentType } from "../generated/client";

const VALID_CONSENT_TYPES = Object.values(ConsentType) as string[];

function parseConsentType(raw: string): ConsentType {
  const upper = raw.toUpperCase();
  if (!VALID_CONSENT_TYPES.includes(upper)) {
    throw createError(
      `Invalid consent type. Valid values: ${VALID_CONSENT_TYPES.join(", ")}`,
      400
    );
  }
  return upper as ConsentType;
}

// ─── GET /api/auth/privacy/consent ────────────────────
// Returns the current consent state for all ConsentTypes.
export const listConsents = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.sub;
    const consents = await getUserConsents(userId);

    res.status(200).json({
      success: true,
      data: { consents },
    });
  }
);

// ─── POST /api/auth/privacy/consent ───────────────────
// Body: { consentType: ConsentType, accepted: boolean }
// Records or updates a single consent.
export const updateConsent = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.sub;
    const { consentType, accepted } = req.body as {
      consentType: string;
      accepted: boolean;
    };

    if (typeof consentType !== "string" || consentType.trim() === "") {
      throw createError("consentType is required", 400);
    }
    if (typeof accepted !== "boolean") {
      throw createError("accepted must be a boolean", 400);
    }

    const type = parseConsentType(consentType);
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;

    await recordConsent(userId, type, accepted, ip);

    auditLog(accepted ? "privacy.consent_recorded" : "privacy.consent_withdrawn", {
      userId,
      detail: { consentType: type },
    });

    res.status(200).json({
      success: true,
      message: accepted
        ? `Consent for ${type} recorded.`
        : `Consent for ${type} withdrawn.`,
      data: {},
    });
  }
);

// ─── DELETE /api/auth/privacy/consent/:type ───────────
// Withdraws a specific consent. DATA_PROCESSING cannot be withdrawn here.
export const withdrawConsentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.sub;
    const type = parseConsentType(req.params.type ?? "");

    await withdrawConsent(userId, type);

    auditLog("privacy.consent_withdrawn", {
      userId,
      detail: { consentType: type },
    });

    res.status(200).json({
      success: true,
      message: `Consent for ${type} withdrawn.`,
      data: {},
    });
  }
);

// ─── GET /api/auth/privacy/export ─────────────────────
// Returns a portable JSON bundle of all personal data (DPDP §11).
export const exportData = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.sub;

  const bundle = await exportUserData(userId);

  auditLog("privacy.data_exported", { userId });

  res
    .status(200)
    .setHeader(
      "Content-Disposition",
      `attachment; filename="digiability-data-export-${Date.now()}.json"`
    )
    .json({
      success: true,
      data: bundle,
    });
});
