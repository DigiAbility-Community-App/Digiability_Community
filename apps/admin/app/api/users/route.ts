import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";

// Helper to parse custom Postgres enum array string formats like "{pwd,caregiver}"
function parsePostgresArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    return val
      .replace(/[{}]/g, "")
      .split(",")
      .map(v => v.trim())
      .filter(v => v.length > 0);
  }
  return [];
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    // Query users with pagination (max 500 per request)
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200"), 500);
    const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);

    const result = await dbPool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u."createdAt" as joined,
        u.roles,
        u."profileComplete",
        u."isEmailVerified",
        up.city as location,
        up."disabilityType",
        up.username,
        COALESCE(fus."isSuspended", false) as "isSuspended"
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up."userId"
      LEFT JOIN forum_user_stats fus ON u.id = fus."userId"
      WHERE u."deletedAt" IS NULL
      ORDER BY u."createdAt" DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const formattedUsers = result.rows.map((row) => {
      const rawRoles = parsePostgresArray(row.roles);
      const roles = rawRoles.map((r: string) => r.toUpperCase());

      const joinedDate = new Date(row.joined);
      const formattedJoined = joinedDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      // Determine status — suspended takes priority over active/inactive
      let status = "Inactive";
      if (row.isSuspended) {
        status = "Suspended";
      } else if (row.isEmailVerified && row.profileComplete) {
        status = "Active";
      }

      return {
        id: row.id,
        name: row.name || "Anonymous",
        email: row.email,
        username: row.username ? `@${row.username}` : "—",
        roles: roles,
        joined: formattedJoined,
        // Store raw ISO date for date-range filtering on the client
        joinedRaw: row.joined,
        location: row.location || "Not Set",
        disabilityType: row.disabilityType || "N/A",
        status: status,
      };
    });

    // Calculate stats
    const totalUsers = formattedUsers.length;
    const activeUsers = formattedUsers.filter(u => u.status === "Active").length;
    const inactiveUsers = formattedUsers.filter(u => u.status === "Inactive").length;
    const suspendedUsers = formattedUsers.filter(u => u.status === "Suspended").length;

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      stats: {
        total: totalUsers.toLocaleString(),
        active: activeUsers.toLocaleString(),
        inactive: inactiveUsers.toLocaleString(),
        suspended: suspendedUsers.toLocaleString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
