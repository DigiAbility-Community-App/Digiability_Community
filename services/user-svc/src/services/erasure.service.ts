import prisma from "../models/prisma.client";
import { raiseAlert } from "./alert.service";

// ─────────────────────────────────────────────────────
// Cross-service erasure
//
// chat-svc and forum-svc own their own Postgres schemas, so erasing a deleted
// user's content there is an HTTP call that can fail after the local deletion
// has already committed.
//
// These calls used to be fire-and-forget `.catch(console.error)`, which meant
// that if CHAT_SVC_URL or INTERNAL_API_SECRET were unset — or the service was
// simply down — the user's messages were never scrubbed, nothing recorded that
// fact, and the user was still told their account had been deleted.
//
// Now each call is awaited with a timeout and its outcome is recorded on the
// RegistrationRecord. A null timestamp means "still owed", and the retention
// worker retries it on its daily pass.
// ─────────────────────────────────────────────────────

const CALL_TIMEOUT_MS = 10_000;

async function callInternal(url: string, secret: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "x-internal-secret": secret,
        "x-internal-ts": String(Date.now()),
      },
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[erasure] ${url} returned ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[erasure] ${url} failed:`, (err as Error).message);
    return false;
  }
}

export interface ErasureOutcome {
  chatDone: boolean;
  forumDone: boolean;
}

/**
 * Erase the user's content in chat-svc and forum-svc.
 *
 * Returns which side succeeded so the caller can record it. Never throws — a
 * downstream failure must not roll back a deletion the user already confirmed;
 * it is recorded as still-owed and retried instead.
 */
export async function eraseCrossServiceContent(userId: string): Promise<ErasureOutcome> {
  const secret = process.env.INTERNAL_API_SECRET;
  const chatSvcUrl = process.env.CHAT_SVC_URL;
  const forumSvcUrl = process.env.FORUM_SVC_URL;

  if (!secret) {
    // Misconfiguration, not a transient failure: without the shared secret no
    // erasure can ever succeed, so say so loudly rather than retrying forever.
    console.error(
      "[erasure] INTERNAL_API_SECRET is not set — cross-service erasure cannot run. " +
        "Deleted users' chat and forum content will NOT be scrubbed until this is configured."
    );
    return { chatDone: false, forumDone: false };
  }

  let chatDone = false;
  if (chatSvcUrl) {
    // Order matters: strip memberships first so the user stops receiving
    // anything, then scrub the content they authored.
    const membershipsOk = await callInternal(
      `${chatSvcUrl}/api/internal/users/${userId}/memberships`,
      secret
    );
    const contentOk = await callInternal(
      `${chatSvcUrl}/api/internal/users/${userId}/content`,
      secret
    );
    chatDone = membershipsOk && contentOk;
  } else {
    console.error("[erasure] CHAT_SVC_URL is not set — chat content not scrubbed.");
  }

  let forumDone = false;
  if (forumSvcUrl) {
    forumDone = await callInternal(
      `${forumSvcUrl}/api/internal/users/${userId}/content`,
      secret
    );
  } else {
    console.error("[erasure] FORUM_SVC_URL is not set — forum content not scrubbed.");
  }

  return { chatDone, forumDone };
}

/** Record which sides completed, so the retention worker knows what is still owed. */
export async function recordErasureOutcome(
  userId: string,
  outcome: ErasureOutcome
): Promise<void> {
  const now = new Date();
  await prisma.registrationRecord.updateMany({
    where: { userId },
    data: {
      ...(outcome.chatDone ? { chatCleanupAt: now } : {}),
      ...(outcome.forumDone ? { forumCleanupAt: now } : {}),
      cleanupAttempts: { increment: 1 },
    },
  });
}

/**
 * Retry erasure for every deletion where a service call never confirmed.
 * Called from the daily retention pass.
 */
export async function retryPendingErasures(): Promise<number> {
  const pending = await prisma.registrationRecord.findMany({
    where: {
      OR: [{ chatCleanupAt: null }, { forumCleanupAt: null }],
      // Give up after a week of daily attempts — at that point it needs a human,
      // and the error log above says what to fix.
      cleanupAttempts: { lt: 7 },
    },
    select: { userId: true, chatCleanupAt: true, forumCleanupAt: true },
    take: 100,
  });

  let repaired = 0;
  for (const record of pending) {
    const outcome = await eraseCrossServiceContent(record.userId);
    await recordErasureOutcome(record.userId, outcome);
    if (
      (record.chatCleanupAt === null && outcome.chatDone) ||
      (record.forumCleanupAt === null && outcome.forumDone)
    ) {
      repaired += 1;
    }
  }

  // Anything still outstanding after several daily attempts is a deletion the
  // user asked for and we have not completed — a live compliance gap, and one
  // nobody would otherwise notice.
  const stuck = await prisma.registrationRecord.count({
    where: {
      OR: [{ chatCleanupAt: null }, { forumCleanupAt: null }],
      cleanupAttempts: { gte: 3 },
    },
  });
  if (stuck > 0) {
    await raiseAlert({
      severity: "critical",
      title: `${stuck} account deletion(s) not fully completed`,
      detail:
        "Chat or forum content belonging to deleted accounts has not been erased after " +
        "repeated attempts. These users were told their data was erased. Check that " +
        "INTERNAL_API_SECRET, CHAT_SVC_URL and FORUM_SVC_URL are set and the services " +
        "are reachable.",
      context: { stuckDeletions: stuck, repairedThisPass: repaired },
    });
  }

  return repaired;
}
