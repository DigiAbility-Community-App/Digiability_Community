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
