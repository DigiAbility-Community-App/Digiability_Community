import { dbPool } from "./db";

/**
 * Snapshot content before it is removed — IT Rules 2021, Rule 3(1)(d).
 *
 * An intermediary must retain removed information and associated records for
 * 180 days for investigation purposes. Every removal path in this panel used to
 * destroy the evidence at the moment of removal:
 *
 *   UPDATE chat.messages SET content = '' ...        ← body gone
 *   DELETE FROM forum_reports WHERE "questionId" ... ← report trail gone
 *
 * Only `chat.reports.messageContent` survived, and only for content someone had
 * reported — nothing proactively removed, and no forum content at all.
 *
 * ⚠️ CALL THIS BEFORE THE REMOVAL RUNS. Snapshotting after the UPDATE captures
 * an empty string, which looks like a working preservation system and is worse
 * than none, because it fails silently. Every call site is ordered deliberately.
 *
 * Modelled on chat.reports.messageContent, which already proves the
 * immutable-snapshot-at-action-time pattern works here.
 */
export type RemovedContentType =
  | "CHAT_MESSAGE"
  | "FORUM_QUESTION"
  | "FORUM_ANSWER"
  | "PROFILE_FIELD";

/** Kept in step with RETENTION_DAYS.removedContent in user-svc. */
const RETENTION_DAYS = 180;

export async function preserveRemovedContent(entry: {
  contentType: RemovedContentType;
  contentId: string;
  /** The content itself, read BEFORE removal. */
  contentSnapshot: string;
  authorId: string;
  conversationId?: string | null;
  /** Admin email, from getAdminSession(). */
  removedBy: string | null | undefined;
  reason?: string | null;
  /** The report that prompted removal; null for a proactive removal. */
  sourceReportId?: string | null;
}): Promise<void> {
  try {
    await dbPool.query(
      `INSERT INTO removed_content_records
         (id, "contentType", "contentId", "contentSnapshot", "authorId",
          "conversationId", "removedBy", reason, "sourceReportId", "removedAt", "purgeAfter")
       VALUES (gen_random_uuid()::text, $1::"RemovedContentType", $2, $3, $4, $5, $6, $7, $8,
               NOW(), NOW() + ($9 || ' days')::interval)`,
      [
        entry.contentType,
        entry.contentId,
        entry.contentSnapshot,
        entry.authorId,
        entry.conversationId ?? null,
        entry.removedBy ?? "unknown-admin",
        entry.reason ?? null,
        entry.sourceReportId ?? null,
        String(RETENTION_DAYS),
      ]
    );
  } catch (e) {
    // Loud, not silent: a missing snapshot means we cannot meet a retention
    // obligation, and unlike an audit row it cannot be reconstructed later.
    console.error(
      "[preserveRemovedContent] FAILED to snapshot content before removal — " +
        "IT Rules 3(1)(d) requires removed content be retained for 180 days:",
      e
    );
  }
}

/** Read a chat message's body before it is blanked. */
export async function readMessageForPreservation(
  messageId: string
): Promise<{ content: string; senderId: string; conversationId: string } | null> {
  try {
    const res = await dbPool.query(
      `SELECT content, "senderId", "conversationId" FROM chat.messages WHERE id = $1`,
      [messageId]
    );
    const row = res.rows[0];
    return row
      ? { content: row.content ?? "", senderId: row.senderId, conversationId: row.conversationId }
      : null;
  } catch (e) {
    console.error("[preserveRemovedContent] could not read message before removal:", e);
    return null;
  }
}

/** Read a forum question's text before it is soft-deleted. */
export async function readQuestionForPreservation(
  questionId: string
): Promise<{ content: string; authorId: string } | null> {
  try {
    const res = await dbPool.query(
      `SELECT title, description, "authorId" FROM forum_questions WHERE id = $1`,
      [questionId]
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      content: [row.title, row.description].filter(Boolean).join("\n\n"),
      authorId: row.authorId,
    };
  } catch (e) {
    console.error("[preserveRemovedContent] could not read question before removal:", e);
    return null;
  }
}

/** Read a forum answer's text before it is soft-deleted. */
export async function readAnswerForPreservation(
  answerId: string
): Promise<{ content: string; authorId: string } | null> {
  try {
    const res = await dbPool.query(
      `SELECT content, "authorId" FROM forum_answers WHERE id = $1`,
      [answerId]
    );
    const row = res.rows[0];
    return row ? { content: row.content ?? "", authorId: row.authorId } : null;
  } catch (e) {
    console.error("[preserveRemovedContent] could not read answer before removal:", e);
    return null;
  }
}
