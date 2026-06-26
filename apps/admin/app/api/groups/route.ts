import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

// ─────────────────────────────────────────────
// POST — create a new group / community
// Writes to chat schema so groups appear in the mobile app.
// ─────────────────────────────────────────────
export async function POST(request: Request) {
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
      initialMembers = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, message: "Group name is required" }, { status: 400 });
    }
    if (!["GENERAL", "CARE_CIRCLE"].includes(subType)) {
      return NextResponse.json({ success: false, message: "Invalid subType" }, { status: 400 });
    }

    const defaultMax = subType === "CARE_CIRCLE" ? 15 : 256;
    const resolvedMax = Number(maxMembers) > 0 ? Number(maxMembers) : defaultMax;

    // Write into chat schema — same schema chat-svc reads from
    const convResult = await dbPool.query(`
      INSERT INTO chat.conversations
        (id, type, "subType", name, description, "createdBy", "maxMembers",
         "editGroupInfo", "addMembers", "sendMessages", "approveNewMembers",
         "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid()::text,
         'GROUP'::"chat"."ConversationType",
         $1::"chat"."GroupSubType",
         $2, $3, 'SYSTEM_ADMIN', $4, $5, $6, $7, $8,
         NOW(), NOW())
      RETURNING id, name, "subType", "createdAt"
    `, [subType, name.trim(), description.trim(), resolvedMax,
        editGroupInfo, addMembers, sendMessages, approveNewMembers]);

    const group = convResult.rows[0];

    if (Array.isArray(initialMembers) && initialMembers.length > 0) {
      const validRolesGeneral    = ["OWNER", "ADMIN", "MEMBER"];
      const validRolesCareCircle = ["OWNER", "CAREGIVER", "MENTOR", "PROFESSIONAL", "MEMBER"];
      const validRoles = subType === "CARE_CIRCLE" ? validRolesCareCircle : validRolesGeneral;

      for (const m of initialMembers) {
        if (!m.userId) continue;
        const role = validRoles.includes(m.role) ? m.role : "MEMBER";
        await dbPool.query(`
          INSERT INTO chat.conversation_members
            (id, "conversationId", "userId", role, "joinedAt", "updatedAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3::"chat"."MemberRole", NOW(), NOW())
          ON CONFLICT ("conversationId", "userId")
            DO UPDATE SET "leftAt" = NULL, role = $3::"chat"."MemberRole", "updatedAt" = NOW()
        `, [group.id, m.userId, role]);
      }
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
export async function GET() {
  try {
    const [groupsResult, statsResult] = await Promise.all([
      dbPool.query(`
        SELECT
          c.id, c.name, c.description, c."subType",
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
