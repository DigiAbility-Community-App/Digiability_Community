import prisma from "../models/prisma.client";

// ─────────────────────────────────────────────────────────────
// Suspension check — cross-schema read of user-svc's `public.users` table.
// chat-svc doesn't model User in its own Prisma schema (owns only the `chat`
// schema), but it shares the same physical Postgres instance, so a raw
// cross-schema read is a single cheap query rather than an HTTP call to
// user-svc (which CLAUDE.md's architecture intentionally avoids at runtime).
// ─────────────────────────────────────────────────────────────

interface SuspensionRow {
  isSuspended: boolean;
  suspendedUntil: Date | null;
  suspensionReason: string | null;
}

export interface SuspensionInfo {
  banned: true;
  permanent: boolean;
  suspendedUntil: string | null;
  reason: string | null;
}

/** Returns ban info if the user is currently suspended, otherwise null. */
export async function checkSuspended(userId: string): Promise<SuspensionInfo | null> {
  const rows = await prisma.$queryRaw<SuspensionRow[]>`
    SELECT "isSuspended", "suspendedUntil", "suspensionReason"
    FROM public.users
    WHERE id = ${userId}
  `;
  const user = rows[0];
  if (!user || !user.isSuspended) return null;
  if (user.suspendedUntil !== null && user.suspendedUntil.getTime() <= Date.now()) return null;

  return {
    banned: true,
    permanent: user.suspendedUntil === null,
    suspendedUntil: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
    reason: user.suspensionReason,
  };
}

// ─────────────────────────────────────────────────────────────
// Group (conversation) suspension.
//
// Distinct from the `sendMessages` permission: that is a group-owner
// setting ("who may post here"), while suspension is a platform-admin
// enforcement action ("nobody may post here"). They were previously the
// same column, which meant a suspended group still accepted posts from
// its own admins, and editing permissions cleared the suspension.
// ─────────────────────────────────────────────────────────────

export interface ConversationSuspensionFields {
  isSuspended: boolean;
  suspendedUntil: Date | null;
  suspensionReason?: string | null;
}

export interface GroupSuspensionInfo {
  suspended: true;
  permanent: boolean;
  suspendedUntil: string | null;
  reason: string | null;
}

/**
 * True when a conversation is under an active admin suspension.
 *
 * A suspension whose `suspendedUntil` has passed has lapsed and is treated
 * as expired here, so a timed suspension ends on its own without needing a
 * background job to flip the flag (same convention as user suspensions).
 */
export function isConversationSuspended(c: ConversationSuspensionFields): boolean {
  if (!c.isSuspended) return false;
  if (c.suspendedUntil === null) return true; // indefinite
  return c.suspendedUntil.getTime() > Date.now();
}

/** Suspension detail for client-facing errors, or null when not suspended. */
export function getConversationSuspension(
  c: ConversationSuspensionFields
): GroupSuspensionInfo | null {
  if (!isConversationSuspended(c)) return null;
  return {
    suspended: true,
    permanent: c.suspendedUntil === null,
    suspendedUntil: c.suspendedUntil ? c.suspendedUntil.toISOString() : null,
    reason: c.suspensionReason ?? null,
  };
}

/** User-facing rejection text for a suspended group. */
export function suspensionRejectionReason(info: GroupSuspensionInfo): string {
  const base = "This group has been suspended by a moderator";
  const until = info.permanent
    ? ""
    : ` until ${new Date(info.suspendedUntil!).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })}`;
  const why = info.reason ? ` Reason: ${info.reason}.` : "";
  return `${base}${until}. You can't send messages here.${why}`;
}
