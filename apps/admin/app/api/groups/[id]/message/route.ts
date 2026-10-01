import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth, getAdminSession, getRequestIp } from "@/lib/auth";
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
  // Actor identity for the audit trail — see lib/audit.ts.
  const actor = await getAdminSession(req);
  const ip = getRequestIp(req);

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

    // chat-svc caps JSON bodies at 10kb; 2000 chars stays under it even for
    // 3-byte scripts (Devanagari etc.) and matches the global broadcast cap.
    if (trimmedSubject.length > 200 || trimmedMessage.length > 2000) {
      return NextResponse.json(
        { success: false, message: "Subject must be at most 200 characters and message at most 2000." },
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

    const formattedContent = `📢 [${trimmedSubject}]\n\n${trimmedMessage}`;
    const msgMetadata = JSON.stringify({
      senderName: "DigiAbility Admin",
      isAdmin: true,
      broadcast: true,
    });

    // 4. Post the message through chat-svc.
    // This used to INSERT into chat.messages with raw SQL, which skipped
    // chat-svc's msg:persisted stream: online members never got a
    // message.new event, so the admin saw "sent" while nothing appeared in
    // the open chat. It also computed sequenceNo without chat-svc's advisory
    // lock and wrote message/recipients/preview as separate statements.
    // There is deliberately no direct-DB fallback — if chat-svc can't take
    // the message, the admin must see a failure, not "sent successfully".
    const chatSvcUrl = process.env.CHAT_SVC_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (!chatSvcUrl || !internalSecret) {
      console.error("Group message: CHAT_SVC_URL / INTERNAL_API_SECRET not configured");
      return NextResponse.json(
        { success: false, message: "Chat service is not configured. The message was not sent." },
        { status: 503 }
      );
    }

    let chatRes: Response;
    try {
      chatRes = await fetch(`${chatSvcUrl}/api/internal/groups/${encodeURIComponent(id)}/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
          "x-internal-ts": String(Date.now()),  // required by internalAuth replay-protection
        },
        body: JSON.stringify({ content: formattedContent, metadata: msgMetadata }),
      });
    } catch (svcErr) {
      console.error("Group message: chat-svc unreachable:", svcErr);
      return NextResponse.json(
        { success: false, message: "Could not reach the chat service. The message was not sent." },
        { status: 502 }
      );
    }

    const chatData = await chatRes.json().catch(() => null) as
      | { success?: boolean; message?: string; data?: { messageId: string; liveDelivered: boolean } }
      | null;
    if (!chatRes.ok || !chatData?.success || !chatData.data) {
      console.error(`Group message: chat-svc returned ${chatRes.status}`, chatData);
      return NextResponse.json(
        {
          success: false,
          message: chatData?.message
            ? `${chatData.message} The message was not sent.`
            : `Chat service error (${chatRes.status}). The message was not sent.`,
        },
        // Pass through only the group-state errors (404 deleted, 409
        // suspended). Anything else — notably 401/403 from internalAuth on a
        // secret mismatch — is our misconfiguration, not the admin's session.
        { status: chatRes.status === 404 || chatRes.status === 409 ? chatRes.status : 502 }
      );
    }
    const { liveDelivered } = chatData.data;

    // 5. In-app notifications for the target audience (one statement, so it
    // either all lands or none of it does).
    const notifType = messageType === "Urgent Alert" ? "ADMIN_ALERT" : "GROUP_ANNOUNCEMENT";
    const notifTitle = `📢 ${groupName}: ${trimmedSubject}`;
    const notifBody = trimmedMessage;

    await dbPool.query(`
      INSERT INTO forum_notifications (id, "userId", type, title, message, read, "relatedId", "createdAt")
      SELECT gen_random_uuid()::text, uid, $2, $3, $4, false, $5, NOW()
      FROM unnest($1::text[]) AS uid
    `, [targetUserIds, notifType, notifTitle, notifBody, id]);

    // 6. Send push notifications via Expo push service
    const pushedCount = await sendBroadcastPush(targetUserIds, notifTitle, notifBody, {
      type: "group_message",
      conversationId: id,
      groupId: id,
    });

    // 7. Log in admin notification logs
    const audienceLabel = `${groupName} (${sendToArr.join(", ")})`;
    await dbPool.query(`
      INSERT INTO admin_notification_logs (title, message, type, audience, sent_count)
      VALUES ($1, $2, $3, $4, $5)
    `, [notifTitle, notifBody, notifType, audienceLabel, targetUserIds.length]);

    // 8. Audit log
    await writeAudit({ adminEmail: actor?.email, ipAddress: ip,
      action: "send_group_message",
      reason: `Broadcasted "${trimmedSubject}" (${messageType || 'General Update'}) to ${targetUserIds.length} members in "${groupName}" (Audience: ${sendToArr.join(', ')})`,
    });

    return NextResponse.json({
      success: true,
      message: liveDelivered
        ? `Message broadcasted successfully to ${targetUserIds.length} members of "${groupName}".`
        : `Message saved to "${groupName}" and notifications sent to ${targetUserIds.length} members, but live delivery failed — members will see it the next time they open the chat.`,
      sentTo: targetUserIds.length,
      pushedTo: pushedCount,
      liveDelivered,
    });
  } catch (error: any) {
    console.error("Group Message send error:", error);
    return NextResponse.json({ success: false, message: error?.message || "Internal server error" }, { status: 500 });
  }
}
