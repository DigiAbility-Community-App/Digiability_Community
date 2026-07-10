import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

// GET /api/moderation/context?conversationId=...&sequence=...
// Returns a small window of messages around the reported one, with live
// sender names, so an admin reviewing a report can see the surrounding
// conversation — not just the bare reported line out of context.
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  const sequenceParam = request.nextUrl.searchParams.get("sequence");

  if (!conversationId || !sequenceParam) {
    return NextResponse.json(
      { success: false, message: "conversationId and sequence are required" },
      { status: 400 }
    );
  }

  const sequence = BigInt(sequenceParam);
  const radius = 5n;

  try {
    const result = await dbPool.query(
      `
      SELECT
        m.id,
        m."senderId",
        m.content,
        m.type,
        m."sequenceNo",
        m."createdAt",
        m."deletedAt",
        u.name as "senderName"
      FROM chat.messages m
      LEFT JOIN users u ON m."senderId" = u.id
      WHERE m."conversationId" = $1
        AND m."sequenceNo" BETWEEN $2::bigint AND $3::bigint
      ORDER BY m."sequenceNo" ASC
      `,
      [conversationId, (sequence - radius).toString(), (sequence + radius).toString()]
    );

    return NextResponse.json({
      success: true,
      messages: result.rows.map((r) => ({
        ...r,
        sequenceNo: String(r.sequenceNo),
      })),
      reportedSequence: sequence.toString(),
    });
  } catch (error) {
    console.error("Failed to fetch report context:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
