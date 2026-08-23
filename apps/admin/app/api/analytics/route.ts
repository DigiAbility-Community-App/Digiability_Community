import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

// Helper to format timestamps to DD/MM/YYYY, HH:mm
function formatActivityDate(dateVal: Date | string | null): string {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year}, ${hours}:${mins}`;
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    // ── 1. Users, Forums, Events, Growth & Roles queries ──
    const [
      usersResult,
      forumsResult,
      eventsResult,
      growth12MResult,
      rolesResult,
      recentUsersResult,
      recentQuestionsResult,
      recentEventsResult,
      recentReportsResult,
    ] = await Promise.all([
      // Users stats
      dbPool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN "isEmailVerified" = true AND "profileComplete" = true AND ("isSuspended" IS NULL OR "isSuspended" = false) THEN 1 END) as active,
          COUNT(CASE WHEN ("isEmailVerified" = false OR "profileComplete" = false) AND ("isSuspended" IS NULL OR "isSuspended" = false) THEN 1 END) as inactive,
          COUNT(CASE WHEN "isSuspended" = true THEN 1 END) as suspended,
          COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '30 days' THEN 1 END) as "newThisMonth",
          COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '7 days' THEN 1 END) as "newThisWeek",
          COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '24 hours' THEN 1 END) as "newToday"
        FROM users
        WHERE "deletedAt" IS NULL
      `),

      // Forum stats
      dbPool.query(`
        SELECT
          COUNT(*) as "totalQuestions",
          COALESCE(SUM(views), 0) as "totalViews",
          COALESCE(SUM("answerCount"), 0) as "totalAnswers",
          COUNT(CASE WHEN status = 'SOLVED' THEN 1 END) as solved,
          COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '7 days' THEN 1 END) as "questionsThisWeek"
        FROM forum_questions
        WHERE "deletedAt" IS NULL
      `),

      // Events stats (safe check for table)
      dbPool.query(`
        SELECT
          COUNT(*) as "totalEvents",
          COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '30 days' THEN 1 END) as "newThisMonth"
        FROM events
      `).catch(() => ({ rows: [{ totalEvents: "0", newThisMonth: "0" }] })),

      // Continuous 12-month user growth (zero-filled for empty months)
      dbPool.query(`
        WITH months AS (
          SELECT generate_series(
            DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
            DATE_TRUNC('month', NOW()),
            '1 month'::interval
          ) AS m
        )
        SELECT
          TO_CHAR(m, 'Mon') as month,
          TO_CHAR(m, 'YYYY-MM') as "monthKey",
          COALESCE(COUNT(u.id), 0)::text as count
        FROM months
        LEFT JOIN users u ON DATE_TRUNC('month', u."createdAt") = months.m AND u."deletedAt" IS NULL
        GROUP BY m
        ORDER BY m ASC
      `),

      // Roles distribution
      dbPool.query(`
        SELECT unnest(roles)::text as role, COUNT(*)::text as count
        FROM users
        WHERE roles IS NOT NULL AND array_length(roles, 1) > 0 AND "deletedAt" IS NULL
        GROUP BY role
        ORDER BY count DESC
      `),

      // Recent users
      dbPool.query(`
        SELECT
          id,
          name,
          email,
          'Joined DigiAbility' as action,
          'Auth' as module,
          "createdAt",
          'APPROVED' as status
        FROM users
        WHERE "deletedAt" IS NULL
        ORDER BY "createdAt" DESC
        LIMIT 6
      `),

      // Recent questions
      dbPool.query(`
        SELECT
          fq.id,
          COALESCE(u.name, 'Community Member') as name,
          COALESCE(u.email, '') as email,
          CONCAT('Posted question: "', LEFT(fq.title, 45), CASE WHEN LENGTH(fq.title) > 45 THEN '...' ELSE '' END, '"') as action,
          'Forums' as module,
          fq."createdAt",
          CASE WHEN fq.status = 'SOLVED' THEN 'RESOLVED' ELSE 'OPEN' END as status
        FROM forum_questions fq
        LEFT JOIN users u ON fq."authorId" = u.id
        WHERE fq."deletedAt" IS NULL
        ORDER BY fq."createdAt" DESC
        LIMIT 6
      `),

      // Recent events
      dbPool.query(`
        SELECT
          id,
          COALESCE(organizer, 'Admin') as name,
          '' as email,
          CONCAT('Created event: "', LEFT(title, 45), CASE WHEN LENGTH(title) > 45 THEN '...' ELSE '' END, '"') as action,
          'Events' as module,
          "createdAt",
          'APPROVED' as status
        FROM events
        ORDER BY "createdAt" DESC
        LIMIT 6
      `).catch(() => ({ rows: [] })),

      // Recent reports
      dbPool.query(`
        SELECT
          fr.id,
          COALESCE(u.name, 'User') as name,
          COALESCE(u.email, '') as email,
          CONCAT('Reported content: ', LEFT(fr.reason, 40), CASE WHEN LENGTH(fr.reason) > 40 THEN '...' ELSE '' END) as action,
          'Moderation' as module,
          fr."createdAt",
          'PENDING' as status
        FROM forum_reports fr
        LEFT JOIN users u ON fr."reporterId" = u.id
        ORDER BY fr."createdAt" DESC
        LIMIT 6
      `).catch(() => ({ rows: [] })),
    ]);

    // ── 2. Merge & sort recent activities across all modules ──
    const combinedActivities = [
      ...recentUsersResult.rows,
      ...recentQuestionsResult.rows,
      ...recentEventsResult.rows,
      ...recentReportsResult.rows,
    ]
      .map((item: any) => ({
        id: item.id,
        name: item.name || "User",
        initials: (item.name || "User")
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((w: string) => w[0] ?? "")
          .join("")
          .toUpperCase() || "U",
        action: item.action,
        module: item.module,
        rawDate: new Date(item.createdAt).getTime(),
        date: formatActivityDate(item.createdAt),
        status: item.status as "OPEN" | "RESOLVED" | "PENDING" | "APPROVED",
      }))
      .sort((a, b) => b.rawDate - a.rawDate)
      .slice(0, 8);

    return NextResponse.json({
      success: true,
      users: usersResult.rows[0],
      forums: forumsResult.rows[0],
      events: eventsResult.rows[0],
      userGrowth: growth12MResult.rows,
      rolesDistribution: rolesResult.rows,
      recentActivity: combinedActivities,
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
