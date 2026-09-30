import prisma from "../models/prisma.client";
import { AppealStatus } from "../generated/client";
import { createError } from "../middleware/error.middleware";
import { withReferenceCode } from "../utils/reference-code.util";

// ─────────────────────────────────────────────────────
// Appeals — Community Guidelines "Appeals"
//
// Published commitments:
//   • appeal within 30 days of the decision notice
//   • we respond within 14 days, or 7 where the account is suspended
//   • reviewed by someone who was not involved in the original decision
//
// That last one only became possible once admin actions carried a real actor
// identity — every audit row used to say "admin-panel", so there was no way to
// tell who decided, and therefore no way to route an appeal away from them.
// ─────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;

export const APPEAL_WINDOW_MS = 30 * DAY;
export const RESPOND_WITHIN_MS = 14 * DAY;
export const RESPOND_WITHIN_SUSPENDED_MS = 7 * DAY;

export interface SubmitAppealInput {
  auditLogId: string;
  grounds: string;
}

/**
 * File an appeal against a specific enforcement decision.
 *
 * The decision is identified by its admin_audit_log entry, which the
 * enforcement notice carries — so an appeal is always tied to a real, dated
 * action by a named admin rather than a vague complaint.
 */
export async function submitAppeal(
  appellantId: string,
  input: SubmitAppealInput
) {
  const grounds = input.grounds?.trim();
  if (!grounds) {
    throw createError("Please tell us why you think this decision was wrong.", 400);
  }

  const decision = await prisma.adminAuditLog.findUnique({
    where: { id: input.auditLogId },
  });
  if (!decision) {
    throw createError("We couldn't find the decision you're appealing.", 404);
  }

  // Only the person the action was taken against may appeal it.
  if (decision.targetType !== "user" || decision.targetId !== appellantId) {
    throw createError("You can only appeal a decision about your own account.", 403);
  }

  const deadline = new Date(decision.createdAt.getTime() + APPEAL_WINDOW_MS);
  if (Date.now() > deadline.getTime()) {
    throw createError(
      "The 30-day window for appealing this decision has passed. You can still contact our Grievance Officer.",
      409
    );
  }

  const existing = await prisma.appeal.findFirst({
    where: { appellantId, targetType: "admin_audit_log", targetId: input.auditLogId },
  });
  if (existing) {
    // "We may decline to review repeated appeals of the same decision."
    throw createError(
      `You have already appealed this decision (${existing.referenceCode}).`,
      409
    );
  }

  // A suspended account gets the shorter 7-day response target — being locked
  // out while waiting is a materially worse position than a warning.
  const account = await prisma.user.findUnique({
    where: { id: appellantId },
    select: { isSuspended: true },
  });
  const window = account?.isSuspended ? RESPOND_WITHIN_SUSPENDED_MS : RESPOND_WITHIN_MS;

  return withReferenceCode("APL", (referenceCode) =>
    prisma.appeal.create({
      data: {
        referenceCode,
        appellantId,
        targetType: "admin_audit_log",
        targetId: input.auditLogId,
        grounds: grounds.slice(0, 5000),
        dueBy: new Date(Date.now() + window),
      },
    })
  );
}

export async function listMyAppeals(appellantId: string) {
  const appeals = await prisma.appeal.findMany({
    where: { appellantId },
    orderBy: { submittedAt: "desc" },
    select: {
      referenceCode: true,
      targetId: true,
      grounds: true,
      status: true,
      submittedAt: true,
      dueBy: true,
      respondedAt: true,
      decisionNote: true,
    },
  });
  return appeals.map((a) => ({
    ...a,
    submittedAt: a.submittedAt.toISOString(),
    dueBy: a.dueBy.toISOString(),
    respondedAt: a.respondedAt?.toISOString() ?? null,
  }));
}

/** Whether this decision can still be appealed, for the client's Appeal button. */
export async function appealability(userId: string, auditLogId: string) {
  const decision = await prisma.adminAuditLog.findUnique({ where: { id: auditLogId } });
  if (!decision || decision.targetType !== "user" || decision.targetId !== userId) {
    return { appealable: false as const, reason: "not_found" };
  }

  const existing = await prisma.appeal.findFirst({
    where: { appellantId: userId, targetType: "admin_audit_log", targetId: auditLogId },
    select: { referenceCode: true, status: true },
  });
  if (existing) {
    return { appealable: false as const, reason: "already_appealed", existing };
  }

  const deadline = new Date(decision.createdAt.getTime() + APPEAL_WINDOW_MS);
  if (Date.now() > deadline.getTime()) {
    return { appealable: false as const, reason: "window_closed", deadline: deadline.toISOString() };
  }

  return { appealable: true as const, deadline: deadline.toISOString() };
}

export interface AdminAppeal {
  id: string;
  referenceCode: string;
  grounds: string;
  status: AppealStatus;
  submittedAt: Date;
  dueBy: Date;
  respondedAt: Date | null;
  decisionNote: string | null;
  reviewedBy: string | null;
  appellant: { id: string; name: string; email: string } | null;
  /** The admin who made the decision being appealed. */
  originalDecisionBy: string | null;
  originalAction: string | null;
  originalReason: string | null;
  responseOverdue: boolean;
}

export async function listAppealsForAdmin(status?: string): Promise<AdminAppeal[]> {
  const where = status && status !== "ALL" ? { status: status as AppealStatus } : undefined;

  const appeals = await prisma.appeal.findMany({
    where,
    orderBy: { submittedAt: "asc" },
    include: { appellant: { select: { id: true, name: true, email: true } } },
    take: 200,
  });

  // Pull the original decisions in one query rather than per row.
  const decisionIds = appeals.map((a) => a.targetId);
  const decisions = decisionIds.length
    ? await prisma.adminAuditLog.findMany({
        where: { id: { in: decisionIds } },
        select: { id: true, adminEmail: true, action: true, reason: true },
      })
    : [];
  const byId = new Map(decisions.map((d) => [d.id, d]));

  const now = Date.now();
  return appeals.map((a) => {
    const d = byId.get(a.targetId);
    return {
      id: a.id,
      referenceCode: a.referenceCode,
      grounds: a.grounds,
      status: a.status,
      submittedAt: a.submittedAt,
      dueBy: a.dueBy,
      respondedAt: a.respondedAt,
      decisionNote: a.decisionNote,
      reviewedBy: a.reviewedBy,
      appellant: a.appellant,
      originalDecisionBy: d?.adminEmail ?? null,
      originalAction: d?.action ?? null,
      originalReason: d?.reason ?? null,
      responseOverdue: !a.respondedAt && now > a.dueBy.getTime(),
    };
  });
}

/**
 * Mark an appeal as being actively reviewed, and record who picked it up.
 *
 * UNDER_REVIEW is in AppealStatus and is a filter on the admin queue, but
 * nothing ever set it — so the filter was permanently empty and two admins
 * could unknowingly work the same appeal. Claiming is subject to the same
 * conflict-of-interest rule as deciding: the admin who made the original
 * decision cannot take it.
 */
export async function claimAppealForReview(appealId: string, reviewerEmail: string) {
  const appeal = await prisma.appeal.findUnique({ where: { id: appealId } });
  if (!appeal) throw createError("Appeal not found.", 404);
  if (appeal.respondedAt) {
    throw createError("This appeal has already been decided.", 409);
  }
  if (appeal.status === "UNDER_REVIEW") {
    throw createError("This appeal is already under review.", 409);
  }

  const decision = await prisma.adminAuditLog.findUnique({
    where: { id: appeal.targetId },
    select: { adminEmail: true },
  });
  if (
    decision?.adminEmail &&
    decision.adminEmail.toLowerCase() === reviewerEmail.toLowerCase()
  ) {
    throw createError(
      "You made the original decision, so you can't review this appeal. It must be reviewed by another admin.",
      403
    );
  }

  return prisma.appeal.update({
    where: { id: appealId },
    // reviewedBy is set now so the queue shows who has it; decideAppeal
    // overwrites it with whoever actually rules, which is the same person
    // in the normal case.
    data: { status: "UNDER_REVIEW", reviewedBy: reviewerEmail },
  });
}

/**
 * Decide an appeal.
 *
 * Refuses if the reviewer is the admin who made the original decision — the
 * Guidelines promise review "by a reviewer who was not involved in it", and a
 * promise the system doesn't enforce is one that quietly won't hold.
 */
export async function decideAppeal(
  appealId: string,
  reviewerEmail: string,
  outcome: "UPHELD" | "OVERTURNED" | "REJECTED",
  decisionNote: string
) {
  if (!decisionNote?.trim()) {
    throw createError("A decision note is required so the outcome is on record.", 400);
  }

  const appeal = await prisma.appeal.findUnique({ where: { id: appealId } });
  if (!appeal) throw createError("Appeal not found.", 404);
  if (appeal.respondedAt) {
    throw createError("This appeal has already been decided.", 409);
  }

  const decision = await prisma.adminAuditLog.findUnique({
    where: { id: appeal.targetId },
    select: { adminEmail: true, action: true },
  });

  if (
    decision?.adminEmail &&
    decision.adminEmail.toLowerCase() === reviewerEmail.toLowerCase()
  ) {
    throw createError(
      "You made the original decision, so you can't review this appeal. It must be reviewed by another admin.",
      403
    );
  }

  // OVERTURNED means "original decision reversed" — so reverse it. Recording
  // the outcome without lifting the enforcement would leave a user who won
  // their appeal still suspended, which is the opposite of what they were
  // told. Only enforcement actions that actually restrict an account are
  // undone here; content removal is not automatically restored (the content
  // may have been hard-deleted, so that stays a deliberate admin step).
  const RESTRICTING_ACTIONS = new Set(["suspend", "ban", "ban_user", "warn_user"]);
  if (outcome === "OVERTURNED" && decision?.action && RESTRICTING_ACTIONS.has(decision.action)) {
    try {
      await prisma.user.update({
        where: { id: appeal.appellantId },
        data: { isSuspended: false, suspendedUntil: null, suspensionReason: null },
      });
      // forum-svc reads its own copy of suspension state, which the admin
      // panel keeps in step — clear it here too or the user stays blocked
      // from the forum despite winning the appeal.
      await prisma.forumUserStats.updateMany({
        where: { userId: appeal.appellantId },
        data: { isSuspended: false, suspendedUntil: null },
      });
    } catch (err) {
      // Surfaced rather than swallowed: the appeal decision is recorded below
      // regardless, but an un-reversed enforcement needs a human to notice.
      console.error("Failed to reverse enforcement after overturned appeal:", err);
    }
  }

  const updated = await prisma.appeal.update({
    where: { id: appealId },
    data: {
      status: outcome as AppealStatus,
      respondedAt: new Date(),
      reviewedBy: reviewerEmail,
      decisionNote: decisionNote.trim(),
    },
  });

  // Tell the appellant. Without this the outcome existed only in the admin
  // panel: someone could file an appeal and never hear back in-app, which
  // makes the published "we aim to respond within 14 days" commitment
  // unobservable from the user's side. Best-effort — a notification failure
  // must not roll back a recorded decision.
  try {
    await prisma.notification.create({
      data: {
        userId: appeal.appellantId,
        type: "APPEAL_DECIDED",
        title:
          outcome === "OVERTURNED"
            ? "Your appeal was upheld"
            : outcome === "UPHELD"
              ? "Your appeal was reviewed"
              : "Your appeal was closed",
        message:
          outcome === "OVERTURNED"
            ? `We reviewed our decision again and reversed it. ${decisionNote.trim()}`
            : outcome === "UPHELD"
              ? `We reviewed our decision again and it stands. ${decisionNote.trim()}`
              : decisionNote.trim(),
        // Points back at the original decision, so opening the notice shows
        // what was appealed alongside the outcome.
        relatedId: updated.referenceCode,
        auditLogId: appeal.targetId,
      },
    });
  } catch (err) {
    console.error("Failed to notify appellant of appeal outcome:", err);
  }

  return updated;
}
