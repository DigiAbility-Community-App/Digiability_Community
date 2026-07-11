// ─────────────────────────────────────────────────────
// Consent Service — DPDP Act 2023 §6 compliance
//
// Records and withdraws user consent for each ConsentType.
// One row per (userId, consentType) — upsert preserves audit
// trail via updatedAt. DATA_PROCESSING consent is mandatory;
// withdrawal requires account deletion.
// ─────────────────────────────────────────────────────

import prisma from "../models/prisma.client";
import { ConsentType } from "../generated/client";
import { createError } from "../middleware/error.middleware";

// Bump this string whenever the privacy policy text changes.
// Legal review is needed before changing this value.
// [LEGAL PLACEHOLDER] — replace with actual policy version date after legal review
export const CURRENT_POLICY_VERSION = "2024-01-01";

// Truncate IPv4 to /24 and IPv6 to /48 for data minimisation
function truncateIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  const v4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.0`;
  const parts = ip.split(":");
  if (parts.length >= 3) return parts.slice(0, 3).join(":") + "::";
  return undefined;
}

export async function recordConsent(
  userId: string,
  consentType: ConsentType,
  accepted: boolean,
  ip?: string
): Promise<void> {
  if (consentType === ConsentType.DATA_PROCESSING && !accepted) {
    throw createError(
      "DATA_PROCESSING consent cannot be withdrawn directly. Delete your account instead.",
      400
    );
  }
  const now = new Date();
  await prisma.userConsent.upsert({
    where: { userId_consentType: { userId, consentType } },
    update: {
      accepted,
      version: CURRENT_POLICY_VERSION,
      ipAddress: truncateIp(ip),
      acceptedAt: accepted ? now : undefined,
      withdrawnAt: accepted ? null : now,
    },
    create: {
      userId,
      consentType,
      accepted,
      version: CURRENT_POLICY_VERSION,
      ipAddress: truncateIp(ip),
      acceptedAt: accepted ? now : null,
      withdrawnAt: accepted ? null : now,
    },
  });
}

export async function getUserConsents(userId: string) {
  return prisma.userConsent.findMany({
    where: { userId },
    orderBy: { consentType: "asc" },
    select: {
      consentType: true,
      accepted: true,
      version: true,
      acceptedAt: true,
      withdrawnAt: true,
      updatedAt: true,
    },
  });
}

export async function withdrawConsent(
  userId: string,
  consentType: ConsentType
): Promise<void> {
  if (consentType === ConsentType.DATA_PROCESSING) {
    throw createError(
      "You cannot withdraw DATA_PROCESSING consent without deleting your account. Use DELETE /api/auth/delete-account instead.",
      400
    );
  }
  const now = new Date();
  await prisma.userConsent.upsert({
    where: { userId_consentType: { userId, consentType } },
    update: { accepted: false, withdrawnAt: now },
    create: {
      userId,
      consentType,
      accepted: false,
      version: CURRENT_POLICY_VERSION,
      withdrawnAt: now,
    },
  });
}

// Called at registration to record mandatory DATA_PROCESSING consent
export async function recordRegistrationConsents(
  userId: string,
  ip?: string
): Promise<void> {
  await recordConsent(userId, ConsentType.DATA_PROCESSING, true, ip);
}
