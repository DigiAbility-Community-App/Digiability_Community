import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import crypto from "crypto";

// Allowlist mapping from the UI's ban durations to safe SQL intervals.
function durationToInterval(duration: string): string | null {
  const map: Record<string, string> = {
    "7 Days": "7 days",
    "30 Days": "30 days",
    "90 Days": "90 days",
  };
  return map[duration] ?? null; // null → permanent
}

async function ensureTables() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS moderation_history (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      report_id TEXT,
      source TEXT NOT NULL,
      content_type TEXT,
      content_preview TEXT,
      reason TEXT,
      author_id TEXT,
      author_name TEXT,
      reporter_id TEXT,
      reporter_name TEXT,
      action_taken TEXT NOT NULL,
      admin_notes TEXT,
      resolved_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// Suspend a user. `users` is the source of truth read by user-svc's
// login/auth gate; forum_user_stats is kept in sync for forum-svc's own
// (forum-scoped) posting checks.
async function suspendUser(userId: string, interval: string | null, reason?: string | null) {
  const uuid = crypto.randomUUID();
  if (interval === null) {
    await dbPool.query(
      `UPDATE users SET "isSuspended" = true, "suspendedUntil" = NULL, "suspensionReason" = $2 WHERE id = $1`,
      [userId, reason ?? null]
    );
    await dbPool.query(
      `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
       VALUES ($1, $2, true, NULL)
       ON CONFLICT ("userId") DO UPDATE SET "isSuspended" = true, "suspendedUntil" = NULL`,
      [uuid, userId]
    );
  } else {
    await dbPool.query(
      `UPDATE users SET "isSuspended" = true, "suspendedUntil" = NOW() + ($2::interval), "suspensionReason" = $3 WHERE id = $1`,
      [userId, interval, reason ?? null]
    );
    await dbPool.query(
      `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
       VALUES ($1, $2, true, NOW() + ($3::interval))
       ON CONFLICT ("userId") DO UPDATE SET "isSuspended" = true, "suspendedUntil" = NOW() + ($3::interval)`,
      [uuid, userId, interval]
    );
  }

  // Remove the banned/suspended user from active group memberships and, for
  // any group where they were the only admin-capable member, auto-promote
  // a stand-in — otherwise a banned group admin leaves the group stuck
  // with nobody able to approve members or moderate chat. Goes through
  // chat-svc's internal API (which runs the succession check) with the
  // previous raw-SQL strip kept as a fallback (no succession in that
  // degraded case) if chat-svc/the internal secret aren't configured.
  const chatSvcUrl = process.env.CHAT_SVC_URL;
  const internalSecret = process.env.INTERNAL_API_SECRET;
  let removedViaService = false;
  if (chatSvcUrl && internalSecret) {
    try {
      const res = await fetch(`${chatSvcUrl}/api/internal/users/${userId}/memberships`, {
        method: "DELETE",
        headers: {
          "x-internal-secret": internalSecret,
          "x-internal-ts": String(Date.now()),
        },
      });
      if (res.ok) {
        removedViaService = true;
      } else {
        console.warn(`chat-svc internal memberships delete returned status ${res.status}, falling back to direct DB update.`);
      }
    } catch (svcErr) {
      console.warn("Failed to reach chat-svc for membership removal, falling back to direct DB update:", svcErr);
    }
  }

  if (!removedViaService) {
    try {
      await dbPool.query(
        `UPDATE chat.conversation_members SET "leftAt" = NOW() WHERE "userId" = $1 AND "leftAt" IS NULL`,
        [userId]
      );
    } catch {}
  }
}

async function notifyUser(
  userId: string,
  type: string,
  title: string,
  message: string,
  relatedId?: string | null
) {
  await dbPool.query(
    `INSERT INTO forum_notifications (id, "userId", type, title, message, read, "relatedId", "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, false, $5, NOW())`,
    [userId, type, title, message, relatedId ?? null]
  );
}

// Looks up a group's display name for a chat-sourced moderation action, so
// the notification can say WHICH group the flagged message was in instead
// of leaving the user to guess. Returns null if not found/not a group.
async function getConversationName(conversationId?: string | null): Promise<string | null> {
  if (!conversationId) return null;
  try {
    const res = await dbPool.query(`SELECT name FROM chat.conversations WHERE id = $1`, [conversationId]);
    return res.rows[0]?.name || null;
  } catch {
    return null;
  }
}

// Shared message builder for warn/ban/removal notifications — always built
// from the admin-chosen reason + a preview of the actual flagged content
// (never from admin-only internal notes fields), so the user sees WHAT
// triggered the action, WHICH group it happened in, and not just that
// something happened.
function buildModerationMessage(
  intro: string,
  reason?: string | null,
  contentPreview?: string | null,
  groupName?: string | null
): string {
  const parts = [`${intro} for: ${reason || "violating community guidelines"}.`];
  if (groupName) parts.push(`Group: ${groupName}`);
  if (contentPreview) parts.push(`Flagged content: "${contentPreview}"`);
  return parts.join("\n\n");
}

// Deletes a chat message via chat-svc's internal API so conversation members
// get a real-time MESSAGE_DELETED WS event, instead of the removal only
// taking effect on their next fetch. Falls back to a direct DB soft-delete
// if chat-svc/the internal secret aren't configured, mirroring the identical
// pattern already used for admin group deletion (groups/[id]/route.ts).
async function deleteMessage(messageId: string, conversationId?: string | null) {
  const chatSvcUrl = process.env.CHAT_SVC_URL;
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (chatSvcUrl && internalSecret && conversationId) {
    try {
      const res = await fetch(`${chatSvcUrl}/api/internal/messages/${messageId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
          "x-internal-ts": String(Date.now()),
        },
        body: JSON.stringify({ conversationId }),
      });
      if (res.ok) return;
      console.warn(
        `chat-svc internal message delete returned status ${res.status}, falling back to direct DB soft-delete.`
      );
    } catch (svcErr) {
      console.warn(
        "Failed to reach chat-svc for internal message delete, falling back to direct DB soft-delete:",
        svcErr
      );
    }
  }

  try {
    await dbPool.query(
      `UPDATE chat.messages SET status = 'DELETED', "deletedAt" = NOW(), content = '' WHERE id = $1`,
      [messageId]
    );
  } catch (msgErr: any) {
    // If status column update fails (e.g., enum constraint), fall back to just clearing content
    console.error("[deleteMessage] status update error, retrying without status:", msgErr?.message);
    await dbPool.query(
      `UPDATE chat.messages SET "deletedAt" = NOW(), content = '' WHERE id = $1`,
      [messageId]
    );
  }
}

async function recordHistory(entry: {
  reportId?: string | null;
  source: string;
  contentType?: string | null;
  contentPreview?: string | null;
  reason?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  reporterId?: string | null;
  reporterName?: string | null;
  actionTaken: string;
  adminNotes?: string | null;
}) {
  await ensureTables();
  await dbPool.query(
    `INSERT INTO moderation_history (
      id, report_id, source, content_type, content_preview, reason,
      author_id, author_name, reporter_id, reporter_name, action_taken, admin_notes, resolved_at
    ) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
    [
      entry.reportId || null,
      entry.source,
      entry.contentType || null,
      entry.contentPreview || null,
      entry.reason || null,
      entry.authorId || null,
      entry.authorName || null,
      entry.reporterId || null,
      entry.reporterName || null,
      entry.actionTaken,
      entry.adminNotes || null,
    ]
  );
}

async function fetchBlockedStats(): Promise<{ chat: number; forum: number; total: number }> {
  try {
    const USER_SVC = process.env.USER_SVC_URL ?? "http://localhost:4001";
    const res = await fetch(`${USER_SVC}/api/moderation/stats`, { cache: "no-store" });
    if (!res.ok) return { chat: 0, forum: 0, total: 0 };
    const json = (await res.json()) as {
      success: boolean;
      data?: { blockedToday?: { chat: number; forum: number; total: number } };
    };
    return json.data?.blockedToday ?? { chat: 0, forum: 0, total: 0 };
  } catch {
    return { chat: 0, forum: 0, total: 0 };
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTables();
    const [reportsResult, suspendedResult, statsResult, blockedStats, historyResult] = await Promise.all([
      dbPool.query(`
        SELECT
          fr.id,
          fr.reason,
          fr."createdAt",
          fr."questionId",
          fr."answerId",
          reporter.id as "reporterId",
          reporter.name as "reporterName",
          reporter.email as "reporterEmail",
          fq.title as "questionTitle",
          fq.description as "questionDescription",
          fq."imageUrl" as "questionImage",
          fa.content as "answerContent",
          fa."imageUrl" as "answerImage",
          COALESCE(qauthor.id, aauthor.id) as "authorId",
          COALESCE(qauthor.name, aauthor.name) as "authorName",
          COALESCE(qauthor.email, aauthor.email) as "authorEmail"
        FROM forum_reports fr
        JOIN users reporter ON fr."reporterId" = reporter.id
        LEFT JOIN forum_questions fq ON fr."questionId" = fq.id
        LEFT JOIN forum_answers fa ON fr."answerId" = fa.id
        LEFT JOIN users qauthor ON fq."authorId" = qauthor.id
        LEFT JOIN users aauthor ON fa."authorId" = aauthor.id
        ORDER BY fr."createdAt" DESC
        LIMIT 100
      `),
      dbPool.query(`
        SELECT
          u.id,
          u."isSuspended",
          u."suspendedUntil",
          u."suspensionReason",
          u.name,
          u.email,
          u.id as "userId"
        FROM users u
        WHERE u."isSuspended" = true
      `),
      dbPool.query(`
        SELECT
          (SELECT COUNT(*) FROM forum_reports) as "totalReports",
          (SELECT COUNT(*) FROM forum_questions WHERE "deletedAt" IS NOT NULL) as "deletedPosts",
          (SELECT COUNT(*) FROM users WHERE "isSuspended" = true) as "suspendedUsers",
          (SELECT COUNT(*) FROM forum_reports WHERE "createdAt" >= NOW() - INTERVAL '24 hours') as "reportsToday"
        FROM (SELECT 1) as t
      `),
      fetchBlockedStats(),
      dbPool.query(`
        SELECT
          id, report_id as "reportId", source, content_type as "contentType",
          content_preview as "contentPreview", reason,
          author_id as "authorId", author_name as "authorName",
          reporter_id as "reporterId", reporter_name as "reporterName",
          action_taken as "actionTaken", admin_notes as "adminNotes",
          resolved_at as "resolvedAt"
        FROM moderation_history
        ORDER BY resolved_at DESC
        LIMIT 100
      `),
    ]);

    // Chat/DM reports (from chat-svc's reports table). Guarded because the
    // table only exists after `prisma db push` on chat-svc.
    let chatReportRows: any[] = [];
    try {
      const chatResult = await dbPool.query(`
        SELECT
          r.id,
          r.reason,
          r."createdAt",
          r."reportedUserId",
          r."messageId",
          r."conversationId",
          r."messageContent",
          r."messageSequence",
          reporter.id as "reporterId",
          reporter.name as "reporterName",
          reporter.email as "reporterEmail",
          reported.name as "authorName",
          reported.email as "authorEmail"
        FROM chat.reports r
        LEFT JOIN users reporter ON r."reporterId" = reporter.id
        LEFT JOIN users reported ON r."reportedUserId" = reported.id
        WHERE r.status = 'OPEN'
        ORDER BY r."createdAt" DESC
        LIMIT 100
      `);
      chatReportRows = chatResult.rows;
    } catch {
      chatReportRows = [];
    }

    // Counted separately rather than using chatReportRows.length — that list
    // is capped at LIMIT 100, so the stat silently under-reported past 100
    // open chat reports. Also counts today's, so reportsToday can cover the
    // same population as the pending total instead of forum-only.
    let pendingChat = 0;
    let chatReportsToday = 0;
    try {
      const chatCounts = await dbPool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'OPEN') AS "pendingChat",
          COUNT(*) FILTER (WHERE status = 'OPEN' AND "createdAt" >= NOW() - INTERVAL '24 hours') AS "chatReportsToday"
        FROM chat.reports
      `);
      pendingChat = Number(chatCounts.rows[0]?.pendingChat ?? 0);
      chatReportsToday = Number(chatCounts.rows[0]?.chatReportsToday ?? 0);
    } catch {
      // chat.reports only exists after `prisma db push` on chat-svc.
      pendingChat = 0;
      chatReportsToday = 0;
    }

    const extractImageUrl = (text?: string | null): string | null => {
      if (!text) return null;
      const trimmed = text.trim();
      if (
        trimmed.startsWith("/uploads/") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://")
      ) {
        if (/\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(trimmed) || trimmed.includes("/uploads/")) {
          return trimmed;
        }
      }
      const match = trimmed.match(/(https?:\/\/[^\s"']+|\/uploads\/[^\s"']+?\.(jpe?g|png|webp|gif))/i);
      return match ? match[0] : null;
    };

    const fmtDate = (d: any) =>
      new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    const forumReports = reportsResult.rows.map((r) => ({
      ...r,
      _ts: new Date(r.createdAt).getTime(),
      // Keep the raw timestamp alongside the pretty date. The review-queue
      // route returns raw ISO, so consumers that render date+time (the
      // review workflow header) used to show 00:00 for anything opened from
      // here, because "04 Sep 2026" parses as midnight.
      createdAtISO: r.createdAt,
      createdAt: fmtDate(r.createdAt),
      type: r.questionId ? "question" : "answer",
      source: "forum" as const,
      imageUrl: r.questionImage || r.answerImage || extractImageUrl(r.questionDescription) || extractImageUrl(r.answerContent) || null,
      fullContent: r.questionDescription || r.answerContent || r.questionTitle || null,
    }));

    const chatReports = chatReportRows.map((r) => ({
      id: r.id,
      reason: r.reason,
      _ts: new Date(r.createdAt).getTime(),
      createdAtISO: r.createdAt,
      createdAt: fmtDate(r.createdAt),
      questionId: null,
      answerId: null,
      questionTitle: null,
      answerContent: r.messageContent || "Reported chat message",
      fullContent: r.messageContent || null,
      imageUrl: extractImageUrl(r.messageContent),
      reporterId: r.reporterId,
      reporterName: r.reporterName || "Unknown",
      reporterEmail: r.reporterEmail || "",
      authorId: r.reportedUserId,
      authorName: r.authorName || "Unknown",
      authorEmail: r.authorEmail || "",
      messageId: r.messageId,
      conversationId: r.conversationId,
      messageSequence: r.messageSequence ? String(r.messageSequence) : null,
      type: "chat" as const,
      source: "chat" as const,
    }));

    const allReports = [...forumReports, ...chatReports]
      .sort((a, b) => b._ts - a._ts)
      .map(({ _ts, ...rest }) => rest);

    const baseStats = statsResult.rows[0];
    // `forum_reports` has no status column — resolved reports are hard-deleted,
    // so COUNT(*) on it IS the pending-forum figure.
    const pendingForum = Number(baseStats.totalReports);
    const stats = {
      ...baseStats,
      totalReports: String(pendingForum + pendingChat),
      // Exposed so the UI can show which source the pending total came from —
      // a combined number sitting next to a forum-only "0 pending" badge was
      // the reported confusion.
      pendingForum: String(pendingForum),
      pendingChat: String(pendingChat),
      // Was forum-only while totalReports counted forum+chat: two stats in the
      // same card measuring different populations.
      reportsToday: String(Number(baseStats.reportsToday) + chatReportsToday),
    };

    const history = historyResult.rows.map((h: any) => ({
      ...h,
      resolvedAtDisplay: new Date(h.resolvedAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    return NextResponse.json({
      success: true,
      reports: allReports,
      history,
      suspendedUsers: suspendedResult.rows,
      stats: {
        ...stats,
        blockedToday: blockedStats.total,
        blockedChatToday: blockedStats.chat,
        blockedForumToday: blockedStats.forum,
      },
    });
  } catch (error) {
    console.error("Failed to fetch moderation data:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTables();
    const body = await request.json();
    const {
      action,
      reportId,
      questionId,
      answerId,
      messageId,
      conversationId,
      userId,
      category,
      message,
      reason,
      duration,
      contentPreview,
      authorName,
      reporterName,
      notifyAuthor,
      internalNotes,
    } = body;

    if (action === "dismiss" || action === "approve") {
      if (reportId) {
        await dbPool.query(`DELETE FROM forum_reports WHERE id = $1`, [reportId]);
      }
      await recordHistory({
        reportId,
        source: "forum",
        contentType: questionId ? "question" : answerId ? "answer" : "forum",
        contentPreview: contentPreview || "Forum content",
        reason: reason || category || "Report review",
        authorId: userId || null,
        authorName: authorName || "Community Member",
        reporterName: reporterName || "Reporter",
        actionTaken: "APPROVED",
        adminNotes: message || "No violation found. Content approved.",
      });
      await writeAudit({ action: "report_dismiss", reason: `forum report ${reportId}` });
    } else if (action === "dismiss_chat" || action === "approve_chat") {
      if (reportId) {
        await dbPool.query(`UPDATE chat.reports SET status = 'DISMISSED' WHERE id = $1`, [reportId]);
      }
      await recordHistory({
        reportId,
        source: "chat",
        contentType: "chat",
        contentPreview: contentPreview || "Chat message",
        reason: reason || "Report review",
        authorId: userId || null,
        authorName: authorName || "Group Member",
        reporterName: reporterName || "Reporter",
        actionTaken: "APPROVED",
        adminNotes: message || "Chat message dismissed. No violation.",
      });
      await writeAudit({ action: "report_dismiss", reason: `chat report ${reportId}` });
    } else if (action === "delete_post" && (questionId || answerId || messageId)) {
      if (questionId) {
        await dbPool.query(
          `UPDATE forum_questions SET "deletedAt" = NOW() WHERE id = $1`,
          [questionId]
        );
        await dbPool.query(`DELETE FROM forum_reports WHERE "questionId" = $1`, [questionId]);
        await recordHistory({
          reportId,
          source: "forum",
          contentType: "question",
          contentPreview: contentPreview || `Question ID ${questionId}`,
          reason: reason || category || "Community guidelines violation",
          authorId: userId || null,
          authorName: authorName || "Author",
          reporterName: reporterName || "Reporter",
          actionTaken: "CONTENT_REMOVED",
          adminNotes: message || "Question permanently removed from forum.",
        });
        await writeAudit({ action: "delete_post", reason: `question ${questionId}` });
        if (userId && notifyAuthor !== false) {
          await notifyUser(
            userId,
            "MODERATION_CONTENT_REMOVED",
            "Your content was removed",
            buildModerationMessage("Your question was removed", reason || category, contentPreview)
          );
        }
      }
      if (answerId) {
        await dbPool.query(
          `UPDATE forum_answers SET "deletedAt" = NOW() WHERE id = $1`,
          [answerId]
        );
        await dbPool.query(`DELETE FROM forum_reports WHERE "answerId" = $1`, [answerId]);
        await recordHistory({
          reportId,
          source: "forum",
          contentType: "answer",
          contentPreview: contentPreview || `Answer ID ${answerId}`,
          reason: reason || category || "Community guidelines violation",
          authorId: userId || null,
          authorName: authorName || "Author",
          reporterName: reporterName || "Reporter",
          actionTaken: "CONTENT_REMOVED",
          adminNotes: message || "Answer permanently removed from forum.",
        });
        await writeAudit({ action: "delete_post", reason: `answer ${answerId}` });
        if (userId && notifyAuthor !== false) {
          await notifyUser(
            userId,
            "MODERATION_CONTENT_REMOVED",
            "Your content was removed",
            buildModerationMessage("Your answer was removed", reason || category, contentPreview)
          );
        }
      }
      if (messageId) {
        await deleteMessage(messageId, conversationId);
        if (reportId) {
          await dbPool.query(`UPDATE chat.reports SET status = 'ACTIONED' WHERE id = $1`, [reportId]);
        }
        await recordHistory({
          reportId,
          source: "chat",
          contentType: "chat",
          contentPreview: contentPreview || `Message ID ${messageId}`,
          reason: reason || category || "Harmful/inappropriate chat message",
          authorId: userId || null,
          authorName: authorName || "Sender",
          reporterName: reporterName || "Reporter",
          actionTaken: "CONTENT_REMOVED",
          adminNotes: message || "Message permanently purged from group/chat conversation.",
        });
        await writeAudit({ action: "delete_post", reason: `chat message ${messageId}` });
        if (userId && notifyAuthor !== false) {
          const groupName = await getConversationName(conversationId);
          await notifyUser(
            userId,
            "MODERATION_CONTENT_REMOVED",
            "Your content was removed",
            buildModerationMessage("Your message was removed", reason || category, contentPreview, groupName),
            conversationId
          );
        }
      }
    } else if (action === "unsuspend" && userId) {
      await dbPool.query(
        `UPDATE users SET "isSuspended" = false, "suspendedUntil" = NULL, "suspensionReason" = NULL WHERE id = $1`,
        [userId]
      );
      await dbPool.query(
        `UPDATE forum_user_stats SET "isSuspended" = false, "suspendedUntil" = NULL WHERE "userId" = $1`,
        [userId]
      );
      await recordHistory({
        source: "user",
        contentType: "user",
        contentPreview: `User account unsuspended: ${authorName || userId}`,
        reason: "Admin review completed",
        authorId: userId,
        authorName: authorName || "User",
        actionTaken: "UNSUSPENDED",
        adminNotes: "Account suspension lifted.",
      });
      await writeAudit({ userId, action: "unsuspend" });
    } else if (action === "warn" && userId) {
      // Notify the offending user; optionally trigger a 7-day suspension.
      const title = `Warning: ${category || "Community Guidelines"}`;
      const warnGroupName = body.source === "chat" ? await getConversationName(conversationId) : null;
      const baseWarnMessage = message || "Your content was flagged for violating community guidelines.";
      const warnParts = [baseWarnMessage];
      if (warnGroupName) warnParts.push(`Group: ${warnGroupName}`);
      if (contentPreview) warnParts.push(`Flagged content: "${contentPreview}"`);
      const warnMessage = warnParts.join("\n\n");
      await notifyUser(userId, "MODERATION_WARNING", title, warnMessage, conversationId);
      if (body.triggerSuspend) {
        await suspendUser(userId, "7 days", warnMessage);
      }
      if (reportId) {
        await dbPool.query(`DELETE FROM forum_reports WHERE id = $1`, [reportId]);
        try {
          await dbPool.query(`UPDATE chat.reports SET status = 'ACTIONED' WHERE id = $1`, [reportId]);
        } catch {}
      }
      await recordHistory({
        reportId,
        source: body.source || "forum",
        contentType: questionId ? "question" : answerId ? "answer" : messageId ? "chat" : "user",
        contentPreview: contentPreview || "Reported content",
        reason: category || "Warning issued",
        authorId: userId,
        authorName: authorName || "Author",
        reporterName: reporterName || "Reporter",
        actionTaken: body.triggerSuspend ? "USER_WARNED_AND_SUSPENDED" : "USER_WARNED",
        adminNotes: warnMessage,
      });
      await writeAudit({ userId, action: "warn", reason: category, message });
    } else if (action === "ban" && userId) {
      // Suspend the offending user (permanent unless a duration is given).
      // The user-facing message is always built from the ban reason +
      // flagged content — never from internalNotes, which is an admin-only
      // audit field (see buildModerationMessage) and must never reach the
      // banned user's notification or their suspensionReason.
      const interval = duration ? durationToInterval(duration) : null;
      const banGroupName = body.source === "chat" ? await getConversationName(conversationId) : null;
      const banMessage = buildModerationMessage(
        "Your account has been suspended",
        reason,
        contentPreview,
        banGroupName
      );
      await suspendUser(userId, interval, banMessage);
      await notifyUser(userId, "MODERATION_BAN", "Your account has been suspended", banMessage, conversationId);
      if (reportId) {
        await dbPool.query(`DELETE FROM forum_reports WHERE id = $1`, [reportId]);
        try {
          await dbPool.query(`UPDATE chat.reports SET status = 'ACTIONED' WHERE id = $1`, [reportId]);
        } catch {}
      }
      await recordHistory({
        reportId,
        source: body.source || "user",
        contentType: "user",
        contentPreview: contentPreview || `User account: ${authorName || userId}`,
        reason: reason || "Severe violation",
        authorId: userId,
        authorName: authorName || "User",
        reporterName: reporterName || "Reporter",
        actionTaken: interval ? `USER_SUSPENDED_${duration?.replace(/\s+/g, "_").toUpperCase()}` : "USER_PERMANENTLY_BANNED",
        adminNotes: internalNotes || banMessage,
      });
      await writeAudit({ userId, action: "ban", reason, message: internalNotes });
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid or incomplete moderation action" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to perform moderation action:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
