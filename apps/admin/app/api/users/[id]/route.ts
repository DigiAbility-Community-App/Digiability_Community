import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import crypto from "crypto";
import { requireAdminAuth } from "@/lib/auth";

function parseRoles(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((r: string) => r.toUpperCase());
  if (typeof raw === "string") {
    return raw
      .replace(/[{}]/g, "")
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter((r) => r.length > 0);
  }
  return [];
}

/** Convert a duration string like "30 days" to a Postgres interval expression */
function durationToInterval(duration: string): string {
  const map: Record<string, string> = {
    "7 days": "7 days",
    "14 days": "14 days",
    "30 days": "30 days",
    "60 days": "60 days",
    "90 days": "90 days",
  };
  return map[duration] ?? "30 days";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    const [userResult, forumStatsResult] = await Promise.all([
      dbPool.query(
        `
        SELECT
          u.id, u.name, u.email, u.roles,
          u."isEmailVerified", u."profileComplete",
          u."createdAt", u."lastSeen", u."phoneNo",
          up.username, up."fullName", up.city, up.state, up.gender, up.dob,
          up."disabilityType", up."disabilitySince", up."verificationStatus", up."verificationDoc",
          up."ngoName", up."ngoRole", up.district,
          up.speciality, up.organization, up."yearsOfExperience",
          up."supportNeeded", up."careRelation",
          COALESCE(fus."isSuspended", false) as "isSuspended",
          fus."suspendedUntil"
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up."userId"
        LEFT JOIN forum_user_stats fus ON u.id = fus."userId"
        WHERE u.id = $1 AND u."deletedAt" IS NULL
      `,
        [id]
      ),
      dbPool.query(
        `
        SELECT
          COUNT(DISTINCT fq.id) as questions,
          COUNT(DISTINCT fa.id) as answers
        FROM users u
        LEFT JOIN forum_questions fq ON fq."authorId" = u.id AND fq."deletedAt" IS NULL
        LEFT JOIN forum_answers fa ON fa."authorId" = u.id AND fa."deletedAt" IS NULL
        WHERE u.id = $1
      `,
        [id]
      ),
    ]);

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const row = userResult.rows[0];
    const roles = parseRoles(row.roles);

    // Status: Suspended takes priority over Active/Inactive
    let status = "Inactive";
    if (row.isSuspended) {
      status = "Suspended";
    } else if (row.isEmailVerified && row.profileComplete) {
      status = "Active";
    }

    return NextResponse.json({
      success: true,
      user: {
        ...row,
        roles,
        status,
        isSuspended: row.isSuspended,
        createdAt: new Date(row.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        lastSeen: row.lastSeen
          ? new Date(row.lastSeen).toLocaleString("en-GB")
          : null,
        forumStats: forumStatsResult.rows[0],
      },
    });
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === "verify_email") {
      await dbPool.query(
        `UPDATE users SET "isEmailVerified" = true WHERE id = $1`,
        [id]
      );
    } else if (action === "suspend") {
      const { duration, reason, message } = body;
      const isPermanent = duration === "Permanent";
      const interval = isPermanent ? null : durationToInterval(duration || "30 days");
      const uuid = crypto.randomUUID();

      if (isPermanent) {
        await dbPool.query(
          `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
           VALUES ($1, $2, true, NULL)
           ON CONFLICT ("userId") DO UPDATE SET "isSuspended" = true, "suspendedUntil" = NULL`,
          [uuid, id]
        );
      } else {
        // Use parameterized cast to avoid SQL injection — interval is already
        // validated against an allowlist in durationToInterval() above.
        await dbPool.query(
          `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
           VALUES ($1, $2, true, NOW() + ($3::interval))
           ON CONFLICT ("userId") DO UPDATE SET "isSuspended" = true, "suspendedUntil" = NOW() + ($3::interval)`,
          [uuid, id, interval]
        );
      }

      // Log the suspension action with reason and message (best-effort)
      if (reason || message) {
        await dbPool.query(
          `INSERT INTO admin_audit_log ("userId", action, reason, message, "createdAt")
           VALUES ($1, 'suspend', $2, $3, NOW())
           ON CONFLICT DO NOTHING`,
          [id, reason || null, message || null]
        ).catch(() => {
          // audit_log table may not exist yet — silently ignore
        });
      }
    } else if (action === "unsuspend") {
      await dbPool.query(
        `UPDATE forum_user_stats SET "isSuspended" = false, "suspendedUntil" = NULL WHERE "userId" = $1`,
        [id]
      );
    } else if (action === "update") {
      // Update basic profile info
      const { fullName, phoneNo, city, state, gender, roles, disabilityType, disabilitySince, supportNeeded } = body;

      // Update users table for phone and roles
      if (phoneNo !== undefined) {
        await dbPool.query(
          `UPDATE users SET "phoneNo" = $1 WHERE id = $2`,
          [phoneNo || null, id]
        );
      }
      if (Array.isArray(roles)) {
        const VALID_ROLES = ["pwd", "caregiver", "therapist", "ngo", "volunteer", "student", "mentor"];
        const rolesArray = roles
          .map((r: string) => String(r).toLowerCase().trim())
          .filter((r) => VALID_ROLES.includes(r));
        await dbPool.query(
          `UPDATE users SET roles = $1 WHERE id = $2`,
          [rolesArray, id]
        );
      }

      // Upsert user_profiles for the rest (including accessibility fields)
      await dbPool.query(
        `INSERT INTO user_profiles (
           "userId", "fullName", city, state, gender,
           "disabilityType", "disabilitySince", "supportNeeded"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("userId") DO UPDATE SET
           "fullName"       = COALESCE($2, user_profiles."fullName"),
           city             = COALESCE($3, user_profiles.city),
           state            = COALESCE($4, user_profiles.state),
           gender           = COALESCE($5, user_profiles.gender),
           "disabilityType" = $6,
           "disabilitySince"= $7,
           "supportNeeded"  = $8`,
        [
          id,
          fullName || null,
          city || null,
          state || null,
          gender || null,
          disabilityType ?? null,
          disabilitySince ?? null,
          supportNeeded ?? null,
        ]
      );
    } else {
      return NextResponse.json(
        { success: false, message: "Unknown action" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    // Soft-delete: anonymise the user's PII and mark deleted
    // This preserves referential integrity with forum posts etc.
    await dbPool.query(
      `UPDATE users SET
         name = 'Deleted User',
         email = 'deleted_' || id || '@deleted.local',
         "phoneNo" = NULL,
         "isEmailVerified" = false,
         "profileComplete" = false,
         "deletedAt" = NOW()
       WHERE id = $1`,
      [id]
    );

    // Also clear the profile so no PII remains visible
    await dbPool.query(
      `UPDATE user_profiles SET
         "fullName" = NULL, username = NULL, city = NULL, state = NULL,
         gender = NULL, dob = NULL, "disabilityType" = NULL
       WHERE "userId" = $1`,
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
