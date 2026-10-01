import { dbPool } from "./db";

/**
 * Record that an administrator was shown private message content.
 *
 * Terms of Use §7 states plainly:
 *
 *   "Your messages are encrypted in transit and access-controlled at rest, but
 *    they are not end-to-end encrypted. We are technically able to access
 *    message content, and we do so only to investigate a report, comply with a
 *    legal obligation, or respond to a credible risk to someone's safety.
 *    Every such access is logged."
 *
 * Before this existed, `/api/moderation/context` read raw message bodies
 * straight out of chat.messages with no trail whatsoever — the promise above
 * was simply untrue.
 *
 * Best-effort, like writeAudit: a logging failure must not break moderation.
 * But unlike an audit row, a missing entry here means we cannot evidence a
 * commitment we published, so failures are logged loudly.
 *
 * Writes into `message_access_logs`, owned by user-svc's Prisma schema
 * (model MessageAccessLog). Created by `prisma db push` in user-svc.
 */
export async function logMessageAccess(entry: {
  /** Acting admin, from getAdminSession(). */
  adminEmail: string | null | undefined;
  /** context_view | queue_listing | report_detail */
  accessType: "context_view" | "queue_listing" | "report_detail";
  /** Null for a queue listing, which spans many conversations. */
  conversationId?: string | null;
  /** Ids of the messages exposed, where known. */
  messageIds?: string[];
  /** Sequence range for a context window. */
  sequenceFrom?: number | bigint | null;
  sequenceTo?: number | bigint | null;
  /** Why this access was lawful — the report being investigated, typically. */
  justification: string;
  reportId?: string | null;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await dbPool.query(
      `INSERT INTO message_access_logs
         (id, "adminEmail", "accessType", "conversationId", "messageIds",
          "sequenceFrom", "sequenceTo", justification, "reportId", "ipAddress", "accessedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        entry.adminEmail ?? "unknown-admin",
        entry.accessType,
        entry.conversationId ?? null,
        entry.messageIds ?? [],
        entry.sequenceFrom != null ? String(entry.sequenceFrom) : null,
        entry.sequenceTo != null ? String(entry.sequenceTo) : null,
        entry.justification,
        entry.reportId ?? null,
        entry.ipAddress ?? null,
      ]
    );
  } catch (e) {
    console.error(
      "[messageAccess] FAILED to log message-content access — Terms §7 requires this be recorded:",
      e
    );
  }
}
