import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

// A group can have at most this many admin-capable members (OWNER counts
// toward this) — mirrors MAX_ADMINS_PER_GROUP in chat-svc's roles.util.ts.
const MAX_ADMINS_PER_GROUP = 3;

function adminRolesFor(subType: string): string[] {
  return subType === "CARE_CIRCLE" ? ["OWNER", "CAREGIVER"] : ["OWNER", "ADMIN"];
}

// ─────────────────────────────────────────────
// POST — create a new group / community
// Writes to chat schema so groups appear in the mobile app.
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      name,
      subType = "GENERAL",
      description = "",
      maxMembers,
      editGroupInfo = "ADMINS_ONLY",
      addMembers = "ADMINS_ONLY",
      sendMessages = "ALL_MEMBERS",
      approveNewMembers = false,
      ownerId,
      initialMembers = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, message: "Group name is required" }, { status: 400 });
    }
    if (!["GENERAL", "CARE_CIRCLE"].includes(subType)) {
      return NextResponse.json({ success: false, message: "Invalid subType" }, { status: 400 });
    }
    // Every group must be created with a designated admin/owner — fixes
    // the previous behavior where admin-created groups had zero OWNER
    // member rows and "createdBy" was the literal string 'SYSTEM_ADMIN'.
    if (!ownerId) {
      return NextResponse.json({ success: false, message: "A group admin must be designated to create the group" }, { status: 400 });
    }

    const defaultMax = subType === "CARE_CIRCLE" ? 15 : 256;
    const resolvedMax = Number(maxMembers) > 0 ? Number(maxMembers) : defaultMax;

    const memberList: Array<{ userId: string; role: string }> = Array.isArray(initialMembers) ? initialMembers : [];
    const ownerIncluded = memberList.some((m) => m.userId === ownerId);
    const totalMemberCount = ownerIncluded ? memberList.length : memberList.length + 1;

    // Enforce the chosen limit against the members being added at creation
    // time — previously nothing checked this, so a 2-member cap with 4
    // initialMembers created the group successfully with all 4.
    if (totalMemberCount > resolvedMax) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot add ${totalMemberCount} members — the group's member limit is ${resolvedMax}.`,
        },
        { status: 400 }
      );
    }

    // Enforce the max-3-admin cap (owner + any admin-capable initial roles).
    const adminRoles = adminRolesFor(subType);
    const adminCount = 1 + memberList.filter((m) => m.userId !== ownerId && adminRoles.includes(m.role)).length;
    if (adminCount > MAX_ADMINS_PER_GROUP) {
      return NextResponse.json(
        { success: false, message: `A group can have at most ${MAX_ADMINS_PER_GROUP} admins (including the owner).` },
        { status: 400 }
      );
    }

    // Go through chat-svc's internal API (not raw SQL) so the group gets a
    // real OWNER via the same createConversation logic mobile/web use —
    // Care Circle role validation, member-limit checks, and this now
    // included, the admin-cap check. Falls back to a direct DB insert only
    // if chat-svc/the internal secret aren't configured.
    const chatSvcUrl = process.env.CHAT_SVC_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (chatSvcUrl && internalSecret) {
      try {
        const res = await fetch(`${chatSvcUrl}/api/internal/groups`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
            "x-internal-ts": String(Date.now()),
          },
          body: JSON.stringify({
            subType,
            name: name.trim(),
            description: description.trim(),
            ownerId,
            initialMembers: memberList.filter((m) => m.userId !== ownerId),
            maxMembers: resolvedMax,
            editGroupInfo,
            addMembers,
            sendMessages,
            approveNewMembers,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          return NextResponse.json({ success: true, group: data.data });
        }
        console.warn(`chat-svc internal group create returned status ${res.status} (${data.message}), falling back to direct DB insert.`);
      } catch (svcErr) {
        console.warn("Failed to reach chat-svc for group creation, falling back to direct DB insert:", svcErr);
      }
    }

    // Fallback: direct DB insert. createdBy is the real owner's id (not the
    // old 'SYSTEM_ADMIN' placeholder), and the owner is inserted explicitly
    // as OWNER — the previous fallback never created an OWNER row at all.
    const convResult = await dbPool.query(`
      INSERT INTO chat.conversations
        (id, type, "subType", name, description, "createdBy", "maxMembers",
         "editGroupInfo", "addMembers", "sendMessages", "approveNewMembers",
         "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid()::text,
         'GROUP'::"chat"."ConversationType",
         $1::"chat"."GroupSubType",
         $2, $3, $4, $5, $6, $7, $8, $9,
         NOW(), NOW())
      RETURNING id, name, "subType", "createdAt"
    `, [subType, name.trim(), description.trim(), ownerId, resolvedMax,
        editGroupInfo, addMembers, sendMessages, approveNewMembers]);

    const group = convResult.rows[0];

    await dbPool.query(`
      INSERT INTO chat.conversation_members
        (id, "conversationId", "userId", role, "joinedAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, 'OWNER'::"chat"."MemberRole", NOW(), NOW())
      ON CONFLICT ("conversationId", "userId")
        DO UPDATE SET "leftAt" = NULL, role = 'OWNER'::"chat"."MemberRole", "updatedAt" = NOW()
    `, [group.id, ownerId]);

    const validRolesGeneral    = ["ADMIN", "MEMBER"];
    const validRolesCareCircle = ["CAREGIVER", "MENTOR", "PROFESSIONAL", "MEMBER"];
    const validRoles = subType === "CARE_CIRCLE" ? validRolesCareCircle : validRolesGeneral;

    for (const m of memberList) {
      if (!m.userId || m.userId === ownerId) continue;
      // OWNER can only be assigned via the owner slot above — a second
      // OWNER role here would silently create a two-owner group.
      const role = validRoles.includes(m.role) ? m.role : "MEMBER";
      await dbPool.query(`
        INSERT INTO chat.conversation_members
          (id, "conversationId", "userId", role, "joinedAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3::"chat"."MemberRole", NOW(), NOW())
        ON CONFLICT ("conversationId", "userId")
          DO UPDATE SET "leftAt" = NULL, role = $3::"chat"."MemberRole", "updatedAt" = NOW()
      `, [group.id, m.userId, role]);
    }

    return NextResponse.json({ success: true, group });
  } catch (error) {
    console.error("Failed to create group:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// GET — list all groups (from chat schema)
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const [groupsResult, statsResult] = await Promise.all([
      dbPool.query(`
        SELECT
          c.id, c.name, c.description, c."subType", c."sendMessages",
          -- Real suspension state. This was previously the derived expression
          -- (c."sendMessages" = 'ADMINS_ONLY'), which reported every
          -- announcement-only group as "Suspended" and flipped the badge
          -- whenever an owner edited the permission.
          -- A lapsed suspension reads as not-suspended without needing a job.
          (c."isSuspended" AND (c."suspendedUntil" IS NULL OR c."suspendedUntil" > NOW())) AS "isSuspended",
          c."suspendedUntil", c."suspensionReason",
          c."createdAt", c."lastMessageAt", c."lastMessageText", c."maxMembers",
          COUNT(cm.id) FILTER (WHERE cm."leftAt" IS NULL) AS "memberCount"
        FROM chat.conversations c
        LEFT JOIN chat.conversation_members cm ON c.id = cm."conversationId"
        WHERE c.type = 'GROUP' AND c."deletedAt" IS NULL
        GROUP BY c.id
        ORDER BY c."createdAt" DESC
        LIMIT 100
      `),
      dbPool.query(`
        SELECT
          COUNT(*) FILTER (WHERE type = 'GROUP' AND "deletedAt" IS NULL) AS "totalGroups",
          COUNT(*) FILTER (WHERE type = 'GROUP' AND "subType" = 'CARE_CIRCLE' AND "deletedAt" IS NULL) AS "careCircles",
          COUNT(*) FILTER (WHERE type = 'GROUP' AND "subType" = 'GENERAL' AND "deletedAt" IS NULL) AS "generalGroups",
          COUNT(*) FILTER (WHERE type = 'DIRECT' AND "deletedAt" IS NULL) AS "directMessages"
        FROM chat.conversations
      `),
    ]);

    return NextResponse.json({
      success: true,
      groups: groupsResult.rows.map((g) => ({
        ...g,
        memberCount: Number(g.memberCount),
        createdAtISO: g.createdAt,
        createdAt: new Date(g.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        }),
        lastMessageAt: g.lastMessageAt
          ? new Date(g.lastMessageAt).toLocaleDateString("en-GB", {
              day: "2-digit", month: "short", year: "numeric",
            })
          : null,
      })),
      stats: statsResult.rows[0],
    });
  } catch (error) {
    console.error("Failed to fetch groups:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
