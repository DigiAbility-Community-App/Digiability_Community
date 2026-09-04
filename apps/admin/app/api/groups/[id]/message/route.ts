import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sendBroadcastPush } from "@/lib/push";

async function ensureNotificationLogsTable() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS admin_notification_logs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50),
      audience VARCHAR(100),
      sent_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// POST /api/groups/[id]/message
// Body: { subject: string, message: string, messageType?: string, sendTo?: string[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    await ensureNotificationLogsTable();
    const { id } = await params;
    const body = await req.json();
    const { subject, message, messageType, sendTo } = body;

    const trimmedSubject = (subject || "").trim();
    const trimmedMessage = (trimmedMessage_raw => (trimmedMessage_raw || "").trim())(message);

    if (!trimmedSubject || !trimmedMessage) {
      return NextResponse.json(
        { success: false, message: "Subject and message content are required." },
        { status: 400 }
      );
    }

    // 1. Verify group exists
    const groupRes = await dbPool.query(
      `SELECT id, name, "createdBy", "subType",
              "isSuspended", "suspendedUntil", "suspensionReason"
         FROM chat.conversations WHERE id = $1 AND "deletedAt" IS NULL`,
      [id]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Group not found or has been deleted." }, { status: 404 });
    }

    const group = groupRes.rows[0];
    const groupName = group.name || "Community Group";

    // 1b. Refuse to broadcast into a suspended group.
    // This route writes straight into chat.messages with raw SQL, so it never
    // passes through chat-svc's WebSocket send path and none of that path's
    // gating applies. Without this check, "suspend the group" would still let
    // the admin dashboard post into it.
    // A lapsed suspension (suspendedUntil in the past) is treated as expired,
    // matching isConversationSuspended() in chat-svc.
    const suspendedUntil: Date | null = group.suspendedUntil;
    const isActivelySuspended =
      group.isSuspended === true &&
      (suspendedUntil === null || new Date(suspendedUntil).getTime() > Date.now());

    if (isActivelySuspended) {
      return NextResponse.json(
        {
          success: false,
          message: suspendedUntil
            ? `"${groupName}" is suspended until ${new Date(suspendedUntil).toLocaleString("en-GB")}. Reactivate the group before sending messages.`
            : `"${groupName}" is suspended indefinitely. Reactivate the group before sending messages.`,
          suspended: true,
          suspendedUntil: suspendedUntil ? new Date(suspendedUntil).toISOString() : null,
          reason: group.suspensionReason ?? null,
        },
        { status: 409 }
      );
    }

    // 2. Determine target audience members
    const sendToArr: string[] = Array.isArray(sendTo)
      ? sendTo
      : sendTo
      ? [sendTo]
      : ["All Members"];

    const isAll = sendToArr.length === 0 || sendToArr.includes("All Members");
    const isModsOnly = sendToArr.includes("Moderators Only") || sendToArr.includes("Admins Only");
    const isActiveOnly = sendToArr.includes("Active Members") || sendToArr.includes("Active Members Only");

    let memberQuery = `
      SELECT cm."userId", cm.role, u.name, u.email, u."isSuspended"
      FROM chat.conversation_members cm
      JOIN users u ON cm."userId" = u.id
      WHERE cm."conversationId" = $1
        AND cm."leftAt" IS NULL
        AND u."deletedAt" IS NULL
    `;

    if (!isAll) {
      if (isModsOnly && !isActiveOnly) {
        memberQuery += ` AND cm.role IN ('OWNER', 'ADMIN', 'CAREGIVER')`;
      } else if (isActiveOnly && !isModsOnly) {
        memberQuery += ` AND (u."isSuspended" = false OR u."isSuspended" IS NULL)`;
      } else if (isModsOnly && isActiveOnly) {
        memberQuery += ` AND cm.role IN ('OWNER', 'ADMIN', 'CAREGIVER') AND (u."isSuspended" = false OR u."isSuspended" IS NULL)`;
      }
    }

    const membersRes = await dbPool.query(memberQuery, [id]);
    const targetMembers = membersRes.rows;
    const targetUserIds: string[] = targetMembers.map((m: any) => m.userId);

    if (targetUserIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No members found in this group matching the selected target audience.",
      }, { status: 404 });
    }

    const messageId = crypto.randomUUID();
    const clientMessageId = crypto.randomUUID();
    const formattedContent = `📢 [${trimmedSubject}]\n\n${trimmedMessage}`;
    const msgMetadata = JSON.stringify({
      senderName: "DigiAbility Admin",
      isAdmin: true,
      broadcast: true,
    });

    // Get next sequence number
    const seqRes = await dbPool.query(
      `SELECT COALESCE(MAX("sequenceNo"), 0) + 1 AS "nextSeq" FROM chat.messages WHERE "conversationId" = $1`,
      [id]
    );
    const nextSeq = parseInt(seqRes.rows[0]?.nextSeq, 10) || 1;

    // 4. Insert message into group chat thread as DigiAbility Admin
    await dbPool.query(`
      INSERT INTO chat.messages (
        id, "conversationId", "senderId", "clientMessageId",
        "sequenceNo", content, type, status, metadata, "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'digiability-admin', $3, $4, $5, 'TEXT', 'PERSISTED', $6, NOW(), NOW())
    `, [messageId, id, clientMessageId, nextSeq, formattedContent, msgMetadata]);

    // 5. Update conversation last message preview
    await dbPool.query(`
      UPDATE chat.conversations
      SET "lastMessageId" = $1,
          "lastMessageText" = $2,
          "lastMessageAt" = NOW(),
          "updatedAt" = NOW()
      WHERE id = $3
    `, [messageId, formattedContent.slice(0, 120), id]);

    // 6. Insert message recipients
    for (const uId of targetUserIds) {
      await dbPool.query(`
        INSERT INTO chat.message_recipients (id, "messageId", "userId", status, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, 'PENDING', NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [crypto.randomUUID(), messageId, uId]);
    }

    // 7. Insert in-app notifications into forum_notifications
    const notifType = messageType === "Urgent Alert" ? "ADMIN_ALERT" : "GROUP_ANNOUNCEMENT";
    const notifTitle = `📢 ${groupName}: ${trimmedSubject}`;
    const notifBody = trimmedMessage;

    for (const uId of targetUserIds) {
      await dbPool.query(`
        INSERT INTO forum_notifications (id, "userId", type, title, message, read, "relatedId", "createdAt")
        VALUES ($1, $2, $3, $4, $5, false, $6, NOW())
      `, [crypto.randomUUID(), uId, notifType, notifTitle, notifBody, id]);
    }

    // 8. Send push notifications via Expo push service
    const pushedCount = await sendBroadcastPush(targetUserIds, notifTitle, notifBody, {
      type: "group_message",
      conversationId: id,
      groupId: id,
    });

    // 9. Log in admin notification logs
    const audienceLabel = `${groupName} (${sendToArr.join(", ")})`;
    await dbPool.query(`
      INSERT INTO admin_notification_logs (title, message, type, audience, sent_count)
      VALUES ($1, $2, $3, $4, $5)
    `, [notifTitle, notifBody, notifType, audienceLabel, targetUserIds.length]);

    // 10. Audit log
    await writeAudit({
      action: "send_group_message",
      reason: `Broadcasted "${trimmedSubject}" (${messageType || 'General Update'}) to ${targetUserIds.length} members in "${groupName}" (Audience: ${sendToArr.join(', ')})`,
    });

    return NextResponse.json({
      success: true,
      message: `Message broadcasted successfully to ${targetUserIds.length} members of "${groupName}".`,
      sentTo: targetUserIds.length,
      pushedTo: pushedCount,
    });
  } catch (error: any) {
    console.error("Group Message send error:", error);
    return NextResponse.json({ success: false, message: error?.message || "Internal server error" }, { status: 500 });
  }
}
