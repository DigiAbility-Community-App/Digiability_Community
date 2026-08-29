import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const rawId = decodeURIComponent(id).trim();
    const cleanUsername = rawId.replace(/^@+/, "").trim();

    const userLookup = await dbPool.query(
      `SELECT u.id FROM users u
       LEFT JOIN user_profiles up ON u.id = up."userId"
       WHERE (u.id = $1 OR LOWER(up.username) = LOWER($1) OR LOWER(up.username) = LOWER($2)) AND u."deletedAt" IS NULL
       LIMIT 1`,
      [rawId, cleanUsername]
    );
    const realUserId = userLookup.rows[0]?.id ?? rawId;

    // 1. Fetch Forum Activity (Questions + Answers)
    let forumActivities: any[] = [];
    try {
      const result = await dbPool.query(`
        SELECT id, 'question' AS type, title AS content, category, "createdAt", "deletedAt",
               views, "answerCount", status::text AS status,
               NULL::boolean AS "isAccepted", 0 AS upvotes, 0 AS downvotes,
               NULL::text AS "questionTitle", NULL::uuid AS "questionId"
        FROM forum_questions WHERE "authorId" = $1
        UNION ALL
        SELECT fa.id, 'answer' AS type, fa.content, fq.category, fa."createdAt", fa."deletedAt",
               0, 0, NULL, fa."isAccepted", fa.upvotes, fa.downvotes, fq.title, fq.id
        FROM forum_answers fa
        JOIN forum_questions fq ON fa."questionId" = fq.id
        WHERE fa."authorId" = $1
        ORDER BY "createdAt" DESC LIMIT 50
      `, [realUserId]);

      forumActivities = result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        content: row.content || "",
        category: row.category || "",
        createdAt: row.createdAt,
        time: new Date(row.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        isDeleted: row.deletedAt !== null,
        views: Number(row.views) || 0,
        answerCount: Number(row.answerCount) || 0,
        status: row.status || null,
        isAccepted: row.isAccepted ?? false,
        upvotes: Number(row.upvotes) || 0,
        downvotes: Number(row.downvotes) || 0,
        questionTitle: row.questionTitle || null,
        questionId: row.questionId || null,
      }));
    } catch (e) {
      console.error("Forum activity fetch error:", e);
    }

    // 2. Fetch Group & Care Circle Memberships
    let groupActivities: any[] = [];
    try {
      const grpResult = await dbPool.query(`
        SELECT
          c.id,
          c.name,
          c."subType",
          cm.role::text AS "userRole",
          cm."joinedAt"
        FROM chat.conversations c
        JOIN chat.conversation_members cm ON c.id = cm."conversationId"
        WHERE cm."userId" = $1 AND cm."leftAt" IS NULL AND c."deletedAt" IS NULL AND c.type = 'GROUP'
        ORDER BY cm."joinedAt" DESC
      `, [realUserId]);

      groupActivities = grpResult.rows.map((r) => ({
        id: `grp-${r.id}`,
        type: r.subType === "CARE_CIRCLE" ? "care_circle_joined" : "group_joined",
        title: r.name || "Community Group",
        content: `Joined as ${r.userRole || "Member"}`,
        category: r.subType === "CARE_CIRCLE" ? "Care Circle" : "Group",
        createdAt: r.joinedAt,
        time: new Date(r.joinedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        groupId: r.id,
      }));
    } catch {
      // Fallback without chat schema
      try {
        const grpResult2 = await dbPool.query(`
          SELECT
            c.id,
            c.name,
            c."subType",
            cm.role::text AS "userRole",
            cm."joinedAt"
          FROM conversations c
          JOIN conversation_members cm ON c.id = cm."conversationId"
          WHERE cm."userId" = $1 AND cm."leftAt" IS NULL AND c."deletedAt" IS NULL AND c.type = 'GROUP'
          ORDER BY cm."joinedAt" DESC
        `, [realUserId]);

        groupActivities = grpResult2.rows.map((r) => ({
          id: `grp-${r.id}`,
          type: r.subType === "CARE_CIRCLE" ? "care_circle_joined" : "group_joined",
          title: r.name || "Community Group",
          content: `Joined as ${r.userRole || "Member"}`,
          category: r.subType === "CARE_CIRCLE" ? "Care Circle" : "Group",
          createdAt: r.joinedAt,
          time: new Date(r.joinedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          groupId: r.id,
        }));
      } catch {}
    }

    // 3. User Account Milestones (Registered / Verification)
    let accountActivities: any[] = [];
    try {
      const userRes = await dbPool.query(`
        SELECT u."createdAt", u."isEmailVerified", u."profileComplete", u.name
        FROM users u WHERE u.id = $1
      `, [realUserId]);
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        accountActivities.push({
          id: `acc-created-${realUserId}`,
          type: "account_created",
          title: "Account Created",
          content: `${u.name} registered on the DigiAbility platform`,
          category: "Security",
          createdAt: u.createdAt,
          time: new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        });
        if (u.isEmailVerified) {
          accountActivities.push({
            id: `acc-verified-${realUserId}`,
            type: "email_verified",
            title: "Email Verified",
            content: "Email address successfully verified",
            category: "Security",
            createdAt: u.createdAt,
            time: new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          });
        }
      }
    } catch {}

    // Combine all activities and sort by date descending
    const allActivities = [...forumActivities, ...groupActivities, ...accountActivities].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      total: allActivities.length,
      activities: allActivities,
      counts: {
        all: allActivities.length,
        questions: forumActivities.filter((a) => a.type === "question").length,
        answers: forumActivities.filter((a) => a.type === "answer").length,
        groups: groupActivities.length,
        account: accountActivities.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch user activity:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
