import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth, getAdminSession, getRequestIp } from "@/lib/auth";
import { logMessageAccess } from "@/lib/messageAccess";

// GET /api/moderation/removed-content
//
// Content removed for breaching the Guidelines or the law, preserved for 180
// days under IT Rules 2021 Rule 3(1)(d).
//
// These records hold the removed content itself — including private message
// bodies that were blanked everywhere else. Reading them is therefore an access
// to message content in the sense of Terms §7, and is logged as one.
//
// Read-only by design: there is no endpoint to edit or delete a preservation
// record. The retention worker purges them on schedule and nothing else does.
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;
  const actor = await getAdminSession(request);
  const ip = getRequestIp(request);

  try {
    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get("contentType");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 200);

    const where =
      contentType && contentType !== "ALL"
        ? `WHERE r."contentType" = $2::"RemovedContentType"`
        : "";
    const params: unknown[] =
      contentType && contentType !== "ALL" ? [limit, contentType] : [limit];

    const result = await dbPool.query(
      `SELECT r.id,
              r."contentType",
              r."contentId",
              r."contentSnapshot",
              r."authorId",
              r."conversationId",
              r."removedBy",
              r.reason,
              r."sourceReportId",
              r."removedAt",
              r."purgeAfter",
              u.name  AS "authorName",
              u.email AS "authorEmail"
         FROM removed_content_records r
         LEFT JOIN users u ON u.id = r."authorId"
         ${where}
        ORDER BY r."removedAt" DESC
        LIMIT $1`,
      params
    );

    // Chat snapshots are private message bodies, so surfacing them is an
    // access under Terms §7 even though the live message is already blanked.
    const chatRows = result.rows.filter((r) => r.contentType === "CHAT_MESSAGE");
    if (chatRows.length > 0) {
      await logMessageAccess({
        adminEmail: actor?.email,
        ipAddress: ip,
        accessType: "report_detail",
        conversationId: null,
        messageIds: chatRows.map((r) => r.contentId as string),
        justification: "Viewing preserved removed-content records (IT Rules 3(1)(d))",
      });
    }

    return NextResponse.json({ success: true, data: { records: result.rows } });
  } catch (err) {
    console.error("Removed content query failed:", err);
    return NextResponse.json(
      { success: false, message: "Failed to load removed content records" },
      { status: 500 }
    );
  }
}
