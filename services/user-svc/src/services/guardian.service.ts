import prisma from "../models/prisma.client";
import { ConsentType } from "../generated/client";
import { createError } from "../middleware/error.middleware";
import { recordConsent, CURRENT_POLICY_VERSION, truncateIp } from "./consent.service";
import { auditLog } from "./audit.service";
import { checkAgeEligibility } from "../utils/age.util";

// ─────────────────────────────────────────────────────
// Guardian Attestation — DPDP Act 2023 §9
//
// §9 requires verifiable parental consent before a Data Fiduciary may process
// a child's personal data. Digiability does not allow under-18 ACCOUNTS
// (see age.util), but a person under 18 may be included in someone's Care
// Circle under their guardian's supervision. This records the guardian's
// confirmation of that relationship.
//
// ⚠️ HONEST LIMITATION — read before relying on this.
//
// This is an ATTESTATION, not verified consent. Nothing here checks that the
// person confirming is genuinely an identifiable adult guardian, so on its own
// it does NOT satisfy §9 / draft Rule 10. The verification mechanism (an OTP to
// the guardian, requiring the guardian to hold their own adult account, or
// DigiLocker) is a deliberate open decision, not an oversight.
//
// Until that lands, docs/legal/06 §1.7 states the limitation plainly, and
// Terms §2 must not claim more than this delivers. See docs/legal/06.
//
// The record itself is the substrate any verification will attach to, so
// capturing it now is what makes the upgrade cheap later.
// ─────────────────────────────────────────────────────

export interface AttestationInput {
  subjectName: string;
  subjectIsMinor: boolean;
  relationship: string;
  conversationId?: string;
  subjectDob?: string;
}

// Mirrors RELATION_OPTIONS in the mobile profile screens.
const VALID_RELATIONSHIPS = ["Parent", "Guardian", "Sibling", "Spouse", "Child", "Other"];

export async function recordGuardianAttestation(
  guardianUserId: string,
  input: AttestationInput,
  ip?: string
) {
  const subjectName = input.subjectName?.trim();
  if (!subjectName) {
    throw createError("The name of the person you care for is required.", 400);
  }
  if (!VALID_RELATIONSHIPS.includes(input.relationship)) {
    throw createError(
      `Relationship must be one of: ${VALID_RELATIONSHIPS.join(", ")}`,
      400
    );
  }

  // If a date of birth was supplied, trust it over the caller's own flag —
  // a client that says "not a minor" about a 12-year-old shouldn't decide that.
  let subjectIsMinor = input.subjectIsMinor;
  if (input.subjectDob) {
    const check = checkAgeEligibility(new Date(`${input.subjectDob}T00:00:00.000Z`));
    subjectIsMinor = !check.eligible;
  }

  const attestation = await prisma.guardianAttestation.create({
    data: {
      guardianUserId,
      subjectName,
      subjectIsMinor,
      relationship: input.relationship,
      conversationId: input.conversationId ?? null,
      policyVersion: CURRENT_POLICY_VERSION,
      // Same minimisation as the consent row — one shared helper rather than a
      // second, weaker copy of the truncation rule.
      ipAddress: truncateIp(ip) ?? null,
    },
  });

  // Also written to the one consent store, so a DPDP data-subject request
  // returns every consent this person has given in a single place rather than
  // missing the guardian ones.
  await recordConsent(guardianUserId, ConsentType.GUARDIAN_CONSENT, true, ip);

  auditLog("privacy.consent_recorded", {
    userId: guardianUserId,
    detail: {
      type: "GUARDIAN_ATTESTATION",
      attestationId: attestation.id,
      subjectIsMinor,
      relationship: input.relationship,
      conversationId: input.conversationId ?? null,
      note: "Self-attested. Not verified consent — see guardian.service header.",
    },
  });

  return attestation;
}

export async function listGuardianAttestations(guardianUserId: string) {
  return prisma.guardianAttestation.findMany({
    where: { guardianUserId, revokedAt: null },
    orderBy: { attestedAt: "desc" },
  });
}

export async function revokeGuardianAttestation(
  guardianUserId: string,
  attestationId: string
) {
  const existing = await prisma.guardianAttestation.findUnique({
    where: { id: attestationId },
  });
  if (!existing || existing.guardianUserId !== guardianUserId) {
    throw createError("Attestation not found.", 404);
  }

  // Soft-revoke: the record that consent WAS given at a point in time is
  // itself the audit trail, so it is marked rather than deleted.
  return prisma.guardianAttestation.update({
    where: { id: attestationId },
    data: { revokedAt: new Date() },
  });
}
