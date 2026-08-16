import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// POST /api/groups/[id]/message
// Body: { subject: string, message: string, messageType?: string, sendTo?: string[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await req.json();
    const { subject, message, messageType, sendTo } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, message: "Message content is required" }, { status: 400 });
    }

    const groupRes = await dbPool.query(
      `SELECT name FROM chat.conversations WHERE id = $1 AND "deletedAt" IS NULL`,
      [id]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Group not found" }, { status: 404 });
    }

    const groupName = groupRes.rows[0].name || "Unnamed Group";

    // Write audit record for admin broadcast
    await writeAudit({
      action: "send_group_message",
      reason: `Broadcast "${subject || 'Announcement'}" (${messageType || 'General Update'}) to group "${groupName}" (ID: ${id})`,
    });

    return NextResponse.json({
      success: true,
      message: `Message broadcasted successfully to members of "${groupName}".`,
    });
  } catch (error) {
    console.error("Group Message error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
