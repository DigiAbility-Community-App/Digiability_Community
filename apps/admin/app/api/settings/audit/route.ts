import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

// ─────────────────────────────────────────────
// GET — load live audit logs from admin_audit_log
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

    const [result, convRes, userRes] = await Promise.all([
      dbPool.query(
        `
        SELECT
          id,
          "adminEmail" as admin,
          action,
          "targetType",
          "targetId",
          reason,
          detail,
          ("createdAt" AT TIME ZONE 'UTC')::timestamptz as created_at
        FROM admin_audit_log
        ORDER BY "createdAt" DESC
        LIMIT $1
      `,
        [limit]
      ),
      dbPool.query(`SELECT id, name FROM chat.conversations`).catch(() => ({ rows: [] })),
      dbPool.query(`SELECT id, name, email FROM public.users`).catch(() => ({ rows: [] })),
    ]);

    const convMap = new Map<string, string>();
    convRes.rows.forEach((c: any) => {
      if (c.id && c.name) convMap.set(c.id, c.name);
    });

    const userMap = new Map<string, { name: string; email: string }>();
    userRes.rows.forEach((u: any) => {
      if (u.id) userMap.set(u.id, { name: u.name || "User", email: u.email || "" });
    });

    const logs = result.rows.map((r) => {
      let detailStr = r.reason || "";
      if (r.detail) {
        try {
          const parsed = typeof r.detail === "string" ? JSON.parse(r.detail) : r.detail;
          detailStr = parsed.message || JSON.stringify(parsed);
        } catch {
          detailStr = String(r.detail);
        }
      }

      // Format action into human-readable label
      let actionLabel = "System Action";
      let moduleLabel = "Platform Settings";
      let moduleType: "system" | "group" | "user" | "security" | "moderation" = "system";

      const rawAction = (r.action || "").toLowerCase();

      if (rawAction.includes("general_settings") || rawAction.includes("maintenance")) {
        actionLabel = detailStr.includes("maintenance_mode=true")
          ? "Maintenance Mode Enabled"
          : detailStr.includes("maintenance_mode=false")
          ? "Maintenance Mode Disabled"
          : "General Settings Updated";
        moduleLabel = "Platform Settings";
        moduleType = "system";
      } else if (rawAction.includes("group")) {
        actionLabel = rawAction.includes("delete") ? "Group Deleted" : "Group Updated";
        moduleLabel = "Group Chats";
        moduleType = "group";
      } else if (rawAction.includes("user")) {
        actionLabel = rawAction.includes("delete") ? "User Account Removed" : "User Role Updated";
        moduleLabel = "User Accounts";
        moduleType = "user";
      } else if (rawAction.includes("security") || rawAction.includes("policy")) {
        actionLabel = "Security Policy Updated";
        moduleLabel = "Security & Auth";
        moduleType = "security";
      } else if (rawAction.includes("notification")) {
        actionLabel = "Notification Settings Saved";
        moduleLabel = "Notifications";
        moduleType = "system";
      } else if (r.action) {
        actionLabel = r.action.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      }

      // Format detail message nicely with Group Name and User Name
      if (detailStr.startsWith("maintenance_mode=")) {
        detailStr = detailStr.includes("true")
          ? "Enabled platform-wide maintenance mode"
          : "Disabled maintenance mode and resumed normal access";
      } else if (rawAction.includes("group") || detailStr.startsWith("conversation ")) {
        let convId = r.targetId && r.targetId !== "-" ? r.targetId : "";
        if (!convId && detailStr.startsWith("conversation ")) {
          convId = detailStr.replace("conversation ", "").trim();
        }
        const groupName = convId ? convMap.get(convId) : null;
        if (groupName && convId) {
          detailStr = `Soft-deleted group "${groupName}" (ID: ${convId.slice(0, 8)}...)`;
        } else if (convId) {
          detailStr = `Soft-deleted conversation group (ID: ${convId.slice(0, 8)}...)`;
        }
      } else if (rawAction.includes("user") || r.targetType === "user") {
        const uId = r.targetId && r.targetId !== "-" ? r.targetId : "";
        const uData = uId ? userMap.get(uId) : null;
        const displayName = uData?.name && uData.name !== "Deleted User" ? uData.name : uData?.email;
        if (displayName && uId) {
          detailStr = `Account deleted and personal data scrubbed for "${displayName}" (ID: ${uId.slice(0, 8)}...)`;
        } else if (uId) {
          detailStr = `Account deleted and personal data scrubbed (ID: ${uId.slice(0, 8)}...)`;
        }
      }

      const isoDate = r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString();

      return {
        id: r.id,
        action: actionLabel,
        rawAction: r.action,
        admin: r.admin || "Admin Panel",
        module: moduleLabel,
        moduleType,
        targetId: r.targetId || "-",
        detail: detailStr || "System configuration modified",
        isoDate,
        status: "Success",
      };
    });

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error("Audit log GET error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
