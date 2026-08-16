import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// POST /api/groups/[id]/suspend
// Body: { action: "suspend" | "unsuspend", period?: string, reason?: string, note?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await req.json();
    const { action, period, reason, note } = body;

    const groupRes = await dbPool.query(
      `SELECT name, description, "sendMessages" FROM chat.conversations WHERE id = $1 AND "deletedAt" IS NULL`,
      [id]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Group not found" }, { status: 404 });
    }

    const groupName = groupRes.rows[0].name || "Unnamed Group";

    if (action === "unsuspend") {
      // Restore normal message sending
      await dbPool.query(
        `UPDATE chat.conversations 
         SET "sendMessages" = 'ALL_MEMBERS', "updatedAt" = NOW() 
         WHERE id = $1`,
        [id]
      );

      await writeAudit({
        action: "unsuspend_group",
        reason: `Reactivated group "${groupName}" (ID: ${id})`,
      });

      return NextResponse.json({
        success: true,
        message: `Group "${groupName}" has been reactivated successfully.`,
      });
    }

    // Action === "suspend"
    // Restrict messages to admins only during suspension
    await dbPool.query(
      `UPDATE chat.conversations 
       SET "sendMessages" = 'ADMINS_ONLY', "updatedAt" = NOW() 
       WHERE id = $1`,
      [id]
    );

    const suspensionSummary = `Suspended for ${period || "Indefinite"} due to: ${reason || "Community Guidelines Violation"}${note ? ` (Note: ${note})` : ""}`;

    await writeAudit({
      action: "suspend_group",
      reason: `Group "${groupName}" (ID: ${id}) - ${suspensionSummary}`,
    });

    return NextResponse.json({
      success: true,
      message: `Group "${groupName}" has been suspended for ${period || "selected duration"}.`,
      suspensionDetails: {
        suspendedAt: new Date().toISOString(),
        period: period || "Indefinite",
        reason: reason || "Community Guidelines Violation",
        note: note || "",
      },
    });
  } catch (error) {
    console.error("Group Suspend error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
