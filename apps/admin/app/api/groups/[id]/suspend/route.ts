import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// Suspension is stored in its own columns on chat.conversations
// (isSuspended / suspendedAt / suspendedUntil / suspensionReason /
// suspensionNote). It deliberately does NOT touch "sendMessages".
//
// "sendMessages" is a group-owner permission ("who may post here") and
// ADMINS_ONLY still permits OWNER/ADMIN/CAREGIVER by design. Using it to
// represent suspension meant (a) group admins could keep posting in a
// suspended group and (b) an owner editing group permissions silently
// cleared the suspension, because it was the very same column.

/**
 * Translate a UI period label into an absolute expiry.
 * Returns null for an indefinite suspension (matches the `suspendedUntil IS
 * NULL` convention used for user suspensions).
 */
function resolveSuspendedUntil(period?: string): Date | null {
  if (!period) return null;
  const label = period.trim();

  if (/^(permanent|indefinite|forever)$/i.test(label)) return null;

  const match = label.match(/^(\d+)\s*(hour|hr|day|week|month)s?$/i);
  if (!match) return null; // unrecognised label → treat as indefinite

  const amount = parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unitMs: Record<string, number> = {
    hour: 3_600_000, hr: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000, // 30 days
  };
  const ms = unitMs[match[2].toLowerCase()];
  if (!ms) return null;

  return new Date(Date.now() + amount * ms);
}

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

    if (action !== "suspend" && action !== "unsuspend") {
      return NextResponse.json(
        { success: false, message: 'action must be "suspend" or "unsuspend"' },
        { status: 400 }
      );
    }

    const groupRes = await dbPool.query(
      `SELECT name FROM chat.conversations WHERE id = $1 AND "deletedAt" IS NULL`,
      [id]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Group not found" }, { status: 404 });
    }

    const groupName = groupRes.rows[0].name || "Unnamed Group";

    if (action === "unsuspend") {
      // Clear suspension only. The group's own sendMessages permission is
      // left exactly as its owner configured it — reactivating must not
      // silently widen (or narrow) who is allowed to post.
      await dbPool.query(
        `UPDATE chat.conversations
            SET "isSuspended"      = false,
                "suspendedAt"      = NULL,
                "suspendedUntil"   = NULL,
                "suspensionReason" = NULL,
                "suspensionNote"   = NULL,
                "updatedAt"        = NOW()
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

    // action === "suspend"
    const suspendedUntil = resolveSuspendedUntil(period);
    const resolvedReason = reason || "Community Guidelines Violation";
    const resolvedNote = note || null;

    await dbPool.query(
      `UPDATE chat.conversations
          SET "isSuspended"      = true,
              "suspendedAt"      = NOW(),
              "suspendedUntil"   = $2,
              "suspensionReason" = $3,
              "suspensionNote"   = $4,
              "updatedAt"        = NOW()
        WHERE id = $1`,
      [id, suspendedUntil, resolvedReason, resolvedNote]
    );

    const periodLabel = suspendedUntil
      ? `${period} (until ${suspendedUntil.toISOString()})`
      : "Indefinite";

    await writeAudit({
      action: "suspend_group",
      reason: `Group "${groupName}" (ID: ${id}) - Suspended for ${periodLabel} due to: ${resolvedReason}${resolvedNote ? ` (Note: ${resolvedNote})` : ""}`,
    });

    return NextResponse.json({
      success: true,
      message: `Group "${groupName}" has been suspended for ${period || "an indefinite period"}.`,
      suspensionDetails: {
        suspendedAt: new Date().toISOString(),
        suspendedUntil: suspendedUntil ? suspendedUntil.toISOString() : null,
        period: period || "Indefinite",
        reason: resolvedReason,
        note: resolvedNote || "",
      },
    });
  } catch (error) {
    console.error("Group Suspend error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
