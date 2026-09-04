import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// GET — single group with members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { id } = await params;

    const [groupRes, membersRes] = await Promise.all([
      dbPool.query(`
        SELECT c.*,
          COUNT(cm.id) FILTER (WHERE cm."leftAt" IS NULL) AS "memberCount"
        FROM chat.conversations c
        LEFT JOIN chat.conversation_members cm ON c.id = cm."conversationId"
        WHERE c.id = $1 AND c."deletedAt" IS NULL
        GROUP BY c.id
      `, [id]),
      dbPool.query(`
        SELECT cm.id, cm."userId", cm.role, cm."joinedAt",
               u.name, u.email
        FROM chat.conversation_members cm
        JOIN public.users u ON cm."userId" = u.id
        WHERE cm."conversationId" = $1 AND cm."leftAt" IS NULL
        ORDER BY cm."joinedAt" ASC
      `, [id]),
    ]);

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Group not found" }, { status: 404 });
    }

    const g = groupRes.rows[0];
    return NextResponse.json({
      success: true,
      group: {
        ...g,
        createdAt: new Date(g.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        updatedAt: new Date(g.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      },
      members: membersRes.rows.map(m => ({
        ...m,
        joinedAt: new Date(m.joinedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      })),
    });
  } catch (error) {
    console.error("Group GET error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update name / description / settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();

    // Whitelist. Only these six columns are editable here — destructuring the
    // body rather than iterating it keeps suspension state (isSuspended,
    // suspendedAt, suspendedUntil, suspensionReason, suspensionNote) out of
    // reach of this endpoint entirely. Suspension is changed only via
    // POST /api/groups/[id]/suspend.
    //
    // This used to be the mechanism behind a silent un-suspend: suspension was
    // stored AS `sendMessages = 'ADMINS_ONLY'`, so an admin editing
    // "Send Messages" to "All Members" here was writing the exact same column
    // the unsuspend action wrote. Those are now separate columns, so editing
    // permissions leaves an active suspension untouched.
    const { name, description, editGroupInfo, addMembers, sendMessages, approveNewMembers } = body;

    const PERMISSION_VALUES = ["ADMINS_ONLY", "ALL_MEMBERS"];
    for (const [field, value] of Object.entries({ editGroupInfo, addMembers, sendMessages })) {
      if (value !== undefined && !PERMISSION_VALUES.includes(value)) {
        return NextResponse.json(
          { success: false, message: `Invalid value for ${field}` },
          { status: 400 }
        );
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined)             { updates.push(`name = $${idx++}`);                values.push(name.trim()); }
    if (description !== undefined)      { updates.push(`description = $${idx++}`);         values.push(description); }
    if (editGroupInfo !== undefined)    { updates.push(`"editGroupInfo" = $${idx++}`);      values.push(editGroupInfo); }
    if (addMembers !== undefined)       { updates.push(`"addMembers" = $${idx++}`);         values.push(addMembers); }
    if (sendMessages !== undefined)     { updates.push(`"sendMessages" = $${idx++}`);       values.push(sendMessages); }
    if (approveNewMembers !== undefined){ updates.push(`"approveNewMembers" = $${idx++}`);  values.push(approveNewMembers); }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: "Nothing to update" }, { status: 400 });
    }

    updates.push(`"updatedAt" = NOW()`);
    values.push(id);

    await dbPool.query(
      `UPDATE chat.conversations SET ${updates.join(", ")} WHERE id = $${idx} AND "deletedAt" IS NULL`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Group PATCH error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// DELETE — soft delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { id } = await params;

    // Go through chat-svc's internal API (not a raw SQL write) so the
    // deletion goes through the real service layer and broadcasts a
    // GROUP_DELETED WS event to every member in real time. Falls back to the
    // direct DB write only if chat-svc/the internal secret isn't configured,
    // so this doesn't hard-fail in an environment that hasn't set it up yet.
    const chatSvcUrl = process.env.CHAT_SVC_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;

    let deletedViaService = false;
    if (chatSvcUrl && internalSecret) {
      try {
        const res = await fetch(`${chatSvcUrl}/api/internal/conversations/${id}`, {
          method: "DELETE",
          headers: {
            "x-internal-secret": internalSecret,
            "x-internal-ts": String(Date.now()),  // required by internalAuth replay-protection
          },
        });
        if (res.ok) {
          deletedViaService = true;
        } else {
          console.warn(
            `chat-svc internal delete returned status ${res.status}, falling back to direct DB soft-delete.`
          );
        }
      } catch (svcErr) {
        console.warn(
          "Failed to reach chat-svc for internal delete, falling back to direct DB soft-delete:",
          svcErr
        );
      }
    }

    // Look up group name before soft-deleting for clear audit trail
    let groupName = "";
    try {
      const gRes = await dbPool.query(`SELECT name FROM chat.conversations WHERE id = $1`, [id]);
      if (gRes.rows.length > 0 && gRes.rows[0].name) {
        groupName = gRes.rows[0].name;
      }
    } catch {}

    if (!deletedViaService) {
      await dbPool.query(
        `UPDATE chat.conversations SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
        [id]
      );
    }

    await writeAudit({
      action: "delete_group",
      reason: groupName ? `"${groupName}" (ID: ${id})` : `conversation ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Group DELETE error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
