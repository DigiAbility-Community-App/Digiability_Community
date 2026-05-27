import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

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

export async function GET() {
  try {
    // Query users and join with user_profiles to get location (city)
    const result = await dbPool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u."createdAt" as joined, 
        u.roles, 
        u."profileComplete",
        u."isEmailVerified",
        up.city as location
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up."userId"
      ORDER BY u."createdAt" DESC
    `);

    const formattedUsers = result.rows.map((row) => {
      // Parse Postgres enum array and map to uppercase
      const rawRoles = parsePostgresArray(row.roles);
      const roles = rawRoles.map((r: string) => r.toUpperCase());

      // Format joined date (e.g., "12 Jun 2026")
      const joinedDate = new Date(row.joined);
      const formattedJoined = joinedDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      // Map status
      let status = "Inactive";
      if (row.isEmailVerified && row.profileComplete) {
        status = "Active";
      }

      return {
        id: row.id,
        name: row.name || "Anonymous",
        email: row.email,
        roles: roles,
        joined: formattedJoined,
        location: row.location || "Not Set",
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
        suspended: suspendedUsers.toLocaleString()
      }
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
