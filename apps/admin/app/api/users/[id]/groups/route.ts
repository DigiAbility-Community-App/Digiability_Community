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

    // Query groups and care circles where the user is a member
    let rows: any[] = [];
    try {
      const res = await dbPool.query(`
        SELECT
          c.id,
          c.name,
          c.description,
          c."subType",
          cm.role::text AS "userRole",
          cm."joinedAt",
          (SELECT COUNT(*) FROM chat.conversation_members cm2 WHERE cm2."conversationId" = c.id AND cm2."leftAt" IS NULL) AS "memberCount"
        FROM chat.conversations c
        JOIN chat.conversation_members cm ON c.id = cm."conversationId"
        WHERE cm."userId" = $1 AND cm."leftAt" IS NULL AND c."deletedAt" IS NULL AND c.type = 'GROUP'
        ORDER BY cm."joinedAt" DESC, c."createdAt" DESC
      `, [id]);
      rows = res.rows;
    } catch {
      // Fallback to public schema if not using chat prefix
      try {
        const res2 = await dbPool.query(`
          SELECT
            c.id,
            c.name,
            c.description,
            c."subType",
            cm.role::text AS "userRole",
            cm."joinedAt",
            (SELECT COUNT(*) FROM conversation_members cm2 WHERE cm2."conversationId" = c.id AND cm2."leftAt" IS NULL) AS "memberCount"
          FROM conversations c
          JOIN conversation_members cm ON c.id = cm."conversationId"
          WHERE cm."userId" = $1 AND cm."leftAt" IS NULL AND c."deletedAt" IS NULL AND c.type = 'GROUP'
          ORDER BY cm."joinedAt" DESC, c."createdAt" DESC
        `, [id]);
        rows = res2.rows;
      } catch (e2) {
        console.error("Groups query error:", e2);
      }
    }

    const careCircles = rows
      .filter((r) => r.subType === "CARE_CIRCLE")
      .map(formatGroup);
    const generalGroups = rows
      .filter((r) => r.subType !== "CARE_CIRCLE")
      .map(formatGroup);

    return NextResponse.json({
      success: true,
      total: rows.length,
      careCirclesCount: careCircles.length,
      generalGroupsCount: generalGroups.length,
      careCircles,
      generalGroups,
      allGroups: rows.map(formatGroup),
    });
  } catch (error) {
    console.error("Failed to fetch user groups:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

function formatGroup(row: any) {
  return {
    id: row.id,
    name: row.name || "Untitled Group",
    description: row.description || "",
    subType: row.subType === "CARE_CIRCLE" ? "CARE_CIRCLE" : "GENERAL",
    userRole: row.userRole || "MEMBER",
    memberCount: Number(row.memberCount) || 1,
    joinedAt: row.joinedAt
      ? new Date(row.joinedAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—",
  };
}
