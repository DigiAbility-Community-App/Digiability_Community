// ─────────────────────────────────────────────────────
// Consent Service — DPDP Act 2023 §6 compliance
//
// Records and withdraws user consent for each ConsentType.
// One row per (userId, consentType) — upsert preserves audit
// trail via updatedAt. DATA_PROCESSING consent is mandatory;
// withdrawal requires account deletion.
// ─────────────────────────────────────────────────────

import prisma from "../models/prisma.client";
import { ConsentType, Prisma } from "../generated/client";
import { createError } from "../middleware/error.middleware";
import { POLICY_VERSION } from "../config/policy-version.generated";

// Accepts an optional transaction client so registration can record consent
// in the same transaction as user creation — a partial failure must not leave
// an unusable account (email taken) with no consent row and no way to retry.
type Db = typeof prisma | Prisma.TransactionClient;

// Single source of truth for the accepted policy version is docs/legal/manifest.json,
// regenerated into policy-version.generated.ts by `npm run sync:legal`. Do not
// hardcode a version string here — it would let the stamped consent version
// disagree with the document text a user actually read.
export const CURRENT_POLICY_VERSION = POLICY_VERSION;

// Truncate IPv4 to /24 and IPv6 to /48 for data minimisation. Exported so
// every consent-adjacent record (including guardian attestations) minimises the
// same way rather than each rolling its own.
export function truncateIp(ip: string | undefined | null): string | undefined {
  if (!ip) return undefined;

  // Express behind a proxy reports IPv4 clients as IPv4-mapped IPv6
  // (::ffff:192.168.1.5). Unwrap it so it truncates as the IPv4 address it is,
  // rather than falling through to the IPv6 branch and keeping the prefix.
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  const candidate = mapped ? mapped[1] : ip;

  const v4 = candidate.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.0`;

  const parts = candidate.split(":");
  if (parts.length >= 3) return parts.slice(0, 3).join(":") + "::";
  return undefined;
}

export async function recordConsent(
  userId: string,
  consentType: ConsentType,
  accepted: boolean,
  ip?: string,
  db: Db = prisma
): Promise<void> {
  if (consentType === ConsentType.DATA_PROCESSING && !accepted) {
    throw createError(
      "DATA_PROCESSING consent cannot be withdrawn directly. Delete your account instead.",
      400
    );
  }
  const now = new Date();
  await db.userConsent.upsert({
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

// Called at registration. Records DATA_PROCESSING (mandatory for the service
// to operate) alongside the Terms and Guidelines acceptance the registration
// gate requires — one consent store, not three separate ad-hoc tables.
export async function recordRegistrationConsents(
  userId: string,
  ip?: string,
  db: Db = prisma
): Promise<void> {
  await Promise.all([
    recordConsent(userId, ConsentType.DATA_PROCESSING, true, ip, db),
    recordConsent(userId, ConsentType.TERMS_OF_USE, true, ip, db),
    recordConsent(userId, ConsentType.COMMUNITY_GUIDELINES, true, ip, db),
  ]);
}

// The set of consents that gate registration and must be re-accepted whenever
// CURRENT_POLICY_VERSION changes.
const ACCEPTANCE_REQUIRED: ConsentType[] = [
  ConsentType.TERMS_OF_USE,
  ConsentType.COMMUNITY_GUIDELINES,
];

/**
 * Required consents this user has not accepted at the current policy version —
 * either never accepted, or accepted an older version. Drives the re-acceptance
 * prompt (and doubles as the annual-notice mechanism: bumping
 * CURRENT_POLICY_VERSION is what puts every existing user back in this list).
 */
export async function getStaleConsents(userId: string): Promise<ConsentType[]> {
  const rows = await prisma.userConsent.findMany({
    where: { userId, consentType: { in: ACCEPTANCE_REQUIRED } },
    select: { consentType: true, accepted: true, version: true },
  });
  const current = new Map(rows.map((r) => [r.consentType, r]));

  return ACCEPTANCE_REQUIRED.filter((type) => {
    const row = current.get(type);
    return !row || !row.accepted || row.version !== CURRENT_POLICY_VERSION;
  });
}

/** True if this user must re-accept anything before creating content. */
export async function needsPolicyReacceptance(userId: string): Promise<boolean> {
  return (await getStaleConsents(userId)).length > 0;
}
