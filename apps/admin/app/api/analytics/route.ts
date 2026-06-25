import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

export async function GET() {
  try {
    const [usersResult, forumsResult, eventsResult, growthResult, rolesResult] =
      await Promise.all([
        dbPool.query(`
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN "isEmailVerified" = true AND "profileComplete" = true THEN 1 END) as active,
            COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '30 days' THEN 1 END) as "newThisMonth",
            COUNT(CASE WHEN "createdAt" >= NOW() - INTERVAL '7 days' THEN 1 END) as "newThisWeek"
          FROM users
        `),
        dbPool.query(`
          SELECT
            COUNT(*) as "totalQuestions",
            COALESCE(SUM(views), 0) as "totalViews",
            COALESCE(SUM("answerCount"), 0) as "totalAnswers",
            COUNT(CASE WHEN status = 'SOLVED' THEN 1 END) as solved
          FROM forum_questions
          WHERE "deletedAt" IS NULL
        `),
        dbPool.query(`
          SELECT COUNT(*) as "totalEvents" FROM events
        `),
        dbPool.query(`
          SELECT
            TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon') as month,
            DATE_TRUNC('month', "createdAt") as "monthDate",
            COUNT(*) as count
          FROM users
          WHERE "createdAt" >= NOW() - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY DATE_TRUNC('month', "createdAt") ASC
        `),
        dbPool.query(`
          SELECT unnest(roles)::text as role, COUNT(*) as count
          FROM users
          WHERE roles IS NOT NULL AND array_length(roles, 1) > 0
          GROUP BY role
          ORDER BY count DESC
        `),
      ]);

    return NextResponse.json({
      success: true,
      users: usersResult.rows[0],
      forums: forumsResult.rows[0],
      events: eventsResult.rows[0],
      userGrowth: growthResult.rows,
      rolesDistribution: rolesResult.rows,
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
