import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, getAdminSession, getRequestIp } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { logMessageAccess } from "@/lib/messageAccess";

// GET /api/moderation/context?conversationId=...&sequence=...&reportId=...
// Returns a small window of messages around the reported one, with live
// sender names, so an admin reviewing a report can see the surrounding
// conversation — not just the bare reported line out of context.
//
// This is the deepest read of private message content in the system: it shows
// messages nobody reported, including from people who are not party to the
// complaint. Terms §7 promises every such access is logged, so it is.
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;
  const actor = await getAdminSession(request);
  const ip = getRequestIp(request);

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  const sequenceParam = request.nextUrl.searchParams.get("sequence");
  // Optional but strongly preferred: ties the access to the report that
  // justified it, which is what makes the log meaningful after the fact.
  const reportId = request.nextUrl.searchParams.get("reportId");

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

    // Logged AFTER a successful read, so the record reflects what was actually
    // exposed rather than what was requested. Awaited so a failure to log is
    // visible rather than racing the response.
    await logMessageAccess({
      adminEmail: actor?.email,
      ipAddress: ip,
      accessType: "context_view",
      conversationId,
      messageIds: result.rows.map((r) => r.id as string),
      // Clamp the lower bound: sequence numbers start at 1, so a window around
      // an early message would otherwise be recorded as starting below zero
      // and read like a bug in the compliance record.
      sequenceFrom: sequence - radius < 1n ? 1n : sequence - radius,
      sequenceTo: sequence + radius,
      reportId,
      justification: reportId
        ? `Investigating report ${reportId}`
        : "Reviewing reported message context",
    });

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
