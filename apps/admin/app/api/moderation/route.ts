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

  // Remove banned user from active group memberships
  try {
    await dbPool.query(
      `UPDATE chat.conversation_members SET "leftAt" = NOW() WHERE "userId" = $1 AND "leftAt" IS NULL`,
      [userId]
    );
  } catch {}
}

async function notifyUser(userId: string, type: string, title: string, message: string) {
  await dbPool.query(
    `INSERT INTO forum_notifications (id, "userId", type, title, message, read, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, false, NOW())`,
    [userId, type, title, message]
  );
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
    const stats = {
      ...baseStats,
      totalReports: String(Number(baseStats.totalReports) + chatReports.length),
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
      userId,
      category,
      message,
      reason,
      duration,
      contentPreview,
      authorName,
      reporterName,
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
      }
      if (messageId) {
        try {
          await dbPool.query(
            `UPDATE chat.messages SET status = 'DELETED', "deletedAt" = NOW(), content = '' WHERE id = $1`,
            [messageId]
          );
        } catch (msgErr: any) {
          // If status column update fails (e.g., enum constraint), fall back to just clearing content
          console.error("[delete_post] message status update error, retrying without status:", msgErr?.message);
          await dbPool.query(
            `UPDATE chat.messages SET "deletedAt" = NOW(), content = '' WHERE id = $1`,
            [messageId]
          );
        }
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
      const warnMessage = message || "Your content was flagged for violating community guidelines.";
      await notifyUser(userId, "MODERATION_WARNING", title, warnMessage);
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
      const interval = duration ? durationToInterval(duration) : null;
      const banMessage =
        message || reason || "Your account has been suspended for violating community guidelines.";
      await suspendUser(userId, interval, banMessage);
      await notifyUser(userId, "MODERATION_BAN", "Your account has been suspended", banMessage);
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
        adminNotes: banMessage,
      });
      await writeAudit({ userId, action: "ban", reason, message });
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
