import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";

// GET /api/moderation/message-access
//
// The record of every time an administrator was shown private message content
// (Terms §7). Read-only and append-only — there is deliberately no endpoint to
// edit or delete these rows, because a trail that can be rewritten by the
// people it covers is not a trail.
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 200);

    const where = type && type !== "ALL" ? `WHERE l."accessType" = $2` : "";
    const params: unknown[] = type && type !== "ALL" ? [limit, type] : [limit];

    const result = await dbPool.query(
      `SELECT l.id,
              l."adminEmail",
              l."accessType",
              l."conversationId",
              l."messageIds",
              l."sequenceFrom",
              l."sequenceTo",
              l.justification,
              l."reportId",
              l."ipAddress",
              l."accessedAt",
              c.name AS "conversationName",
              c.type AS "conversationType"
         FROM message_access_logs l
         LEFT JOIN chat.conversations c ON c.id = l."conversationId"
         ${where}
        ORDER BY l."accessedAt" DESC
        LIMIT $1`,
      params
    );

    return NextResponse.json({
      success: true,
      data: {
        entries: result.rows.map((r) => ({
          ...r,
          // BigInt columns come back as strings from node-pg; keep them that way.
          messageCount: Array.isArray(r.messageIds) ? r.messageIds.length : 0,
        })),
      },
    });
  } catch (err) {
    console.error("Message access log query failed:", err);
    return NextResponse.json(
      { success: false, message: "Failed to load message access log" },
      { status: 500 }
    );
  }
}
