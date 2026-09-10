import prisma from "../models/prisma.client";
import { GrievanceStatus } from "../generated/client";
import { createError } from "../middleware/error.middleware";
import { withReferenceCode } from "../utils/reference-code.util";

// ─────────────────────────────────────────────────────
// Grievance Redressal — IT Rules 2021 Rule 3(2), DPDP §13(5)
//
// The formal complaint mechanism, distinct from content reports. A report says
// "this post breaks the rules"; a grievance says "the platform itself has
// wronged me" — including complaints about how a report was handled.
//
// The published commitment (Terms §15, Community Guidelines) is:
//   • acknowledge within 24 hours
//   • resolve within 15 days
//   • give the complainant a ticket reference
//
// receivedAt/acknowledgedAt/resolvedAt exist so those are measurable rather
// than aspirational. Before this, the mobile "support ticket" form was a
// setTimeout that called no API at all, and promised a 24-hour response that
// nothing anywhere tracked.
// ─────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Published in Terms §15. Changing these changes a public commitment. */
export const ACKNOWLEDGE_WITHIN_MS = 24 * HOUR;
export const RESOLVE_WITHIN_MS = 15 * DAY;

// Mirrors the categories offered in the mobile Contact Support screen.
export const GRIEVANCE_CATEGORIES = [
  "Account & Login",
  "Accessibility Needs",
  "Report a Bug",
  "Safety & Harassment",
  "Care Circle Support",
  "Content Removal Appeal",
  "Data & Privacy",
  "General Inquiry",
] as const;

export interface CreateGrievanceInput {
  category: string;
  subject: string;
  body: string;
  contactEmail?: string;
}

export function acknowledgementDueAt(receivedAt: Date): Date {
  return new Date(receivedAt.getTime() + ACKNOWLEDGE_WITHIN_MS);
}

export function resolutionDueAt(receivedAt: Date): Date {
  return new Date(receivedAt.getTime() + RESOLVE_WITHIN_MS);
}

export interface SlaState {
  acknowledgementDueAt: string;
  resolutionDueAt: string;
  /** Past 24h with no acknowledgement — a breach of the published commitment. */
  acknowledgementOverdue: boolean;
  /** Past 15 days with no resolution. */
  resolutionOverdue: boolean;
}

export function slaStateFor(ticket: {
  receivedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}, now: Date = new Date()): SlaState {
  const ackDue = acknowledgementDueAt(ticket.receivedAt);
  const resDue = resolutionDueAt(ticket.receivedAt);
  return {
    acknowledgementDueAt: ackDue.toISOString(),
    resolutionDueAt: resDue.toISOString(),
    acknowledgementOverdue: !ticket.acknowledgedAt && now > ackDue,
    resolutionOverdue: !ticket.resolvedAt && now > resDue,
  };
}

export async function createGrievance(
  userId: string | null,
  contactEmail: string,
  input: CreateGrievanceInput
) {
  const subject = input.subject?.trim();
  const body = input.body?.trim();

  if (!body) throw createError("Please describe your complaint.", 400);
  if (!subject) throw createError("Please give your complaint a subject.", 400);
  if (!input.category?.trim()) throw createError("Please choose a category.", 400);

  return withReferenceCode("GRV", (referenceCode) =>
    prisma.grievanceTicket.create({
      data: {
        referenceCode,
        userId,
        contactEmail,
        category: input.category.trim(),
        subject: subject.slice(0, 200),
        body: body.slice(0, 5000),
      },
    })
  );
}

/** A complainant's own tickets, so they can see progress against the SLA. */
export async function listMyGrievances(userId: string) {
  const tickets = await prisma.grievanceTicket.findMany({
    where: { userId },
    orderBy: { receivedAt: "desc" },
    select: {
      referenceCode: true,
      category: true,
      subject: true,
      status: true,
      receivedAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      resolutionNote: true,
    },
  });

  return tickets.map((t) => ({
    ...t,
    receivedAt: t.receivedAt.toISOString(),
    acknowledgedAt: t.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
  }));
}

/**
 * Admin queue. Ordered so anything already in breach surfaces first — an SLA
 * nobody can see is one nobody meets.
 */
export async function listGrievancesForAdmin(opts: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const where = opts.status && opts.status !== "ALL"
    ? { status: opts.status as GrievanceStatus }
    : undefined;

  const [tickets, total] = await Promise.all([
    prisma.grievanceTicket.findMany({
      where,
      orderBy: { receivedAt: "asc" },
      take: Math.min(opts.limit ?? 50, 100),
      skip: opts.offset ?? 0,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.grievanceTicket.count({ where }),
  ]);

  const now = new Date();
  const withSla = tickets.map((t) => ({ ...t, sla: slaStateFor(t, now) }));

  withSla.sort((a, b) => {
    const rank = (x: typeof a) =>
      x.sla.acknowledgementOverdue ? 0 : x.sla.resolutionOverdue ? 1 : 2;
    const diff = rank(a) - rank(b);
    return diff !== 0 ? diff : a.receivedAt.getTime() - b.receivedAt.getTime();
  });

  return { tickets: withSla, total };
}

export async function acknowledgeGrievance(id: string, adminEmail: string) {
  const ticket = await prisma.grievanceTicket.findUnique({ where: { id } });
  if (!ticket) throw createError("Grievance not found.", 404);

  // Acknowledgement is a point in time, not a toggle: re-acknowledging would
  // rewrite the timestamp and make a missed SLA look met.
  if (ticket.acknowledgedAt) return ticket;

  return prisma.grievanceTicket.update({
    where: { id },
    data: {
      acknowledgedAt: new Date(),
      status: GrievanceStatus.ACKNOWLEDGED,
      assignedTo: ticket.assignedTo ?? adminEmail,
    },
  });
}

export async function resolveGrievance(
  id: string,
  adminEmail: string,
  resolutionNote: string
) {
  const ticket = await prisma.grievanceTicket.findUnique({ where: { id } });
  if (!ticket) throw createError("Grievance not found.", 404);
  if (!resolutionNote?.trim()) {
    throw createError("A resolution note is required so the outcome is on record.", 400);
  }

  const now = new Date();
  return prisma.grievanceTicket.update({
    where: { id },
    data: {
      // A grievance resolved without ever being acknowledged still had to be
      // acknowledged at some point — backfill rather than leave a null that
      // would read as "never acknowledged" in the SLA report.
      acknowledgedAt: ticket.acknowledgedAt ?? now,
      resolvedAt: now,
      status: GrievanceStatus.RESOLVED,
      resolutionNote: resolutionNote.trim(),
      assignedTo: ticket.assignedTo ?? adminEmail,
    },
  });
}

/** Counts for the admin dashboard badge. */
export async function grievanceSlaSummary() {
  const open = await prisma.grievanceTicket.findMany({
    where: { status: { notIn: [GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED] } },
    select: { receivedAt: true, acknowledgedAt: true, resolvedAt: true },
  });

  const now = new Date();
  let acknowledgementOverdue = 0;
  let resolutionOverdue = 0;
  for (const t of open) {
    const sla = slaStateFor(t, now);
    if (sla.acknowledgementOverdue) acknowledgementOverdue += 1;
    if (sla.resolutionOverdue) resolutionOverdue += 1;
  }

  return { open: open.length, acknowledgementOverdue, resolutionOverdue };
}
