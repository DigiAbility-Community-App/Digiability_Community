import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import crypto from "crypto";
import { requireAdminAuth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

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
    const rawId = decodeURIComponent(id).trim();
    const cleanUsername = rawId.replace(/^@+/, "").trim();

    const [userResult, forumStatsResult] = await Promise.all([
      dbPool.query(
        `
        SELECT
          u.id, u.name, u.email, u.roles,
          u."isEmailVerified", u."profileComplete",
          u."createdAt", u."lastSeen", u."phoneNo",
          up.username, up."fullName", up.city, up.state, up.gender, up.dob,
          up."addressLine1", up."streetArea", up.pincode, up."locationDistrict",
          up."disabilityType", up."disabilitySince", up."verificationStatus", up."verificationDoc",
          up."carePersonName", up."careRelation", up."careDob", up."careDisabilityType",
          up."ngoName", up."ngoRole", up.district,
          up.speciality, up.organization, up."yearsOfExperience",
          up."supportNeeded",
          u."isSuspended",
          u."suspendedUntil",
          u."suspensionReason"
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up."userId"
        WHERE (u.id = $1 OR LOWER(up.username) = LOWER($1) OR LOWER(up.username) = LOWER($2)) AND u."deletedAt" IS NULL
        LIMIT 1
      `,
        [rawId, cleanUsername]
      ),
      dbPool.query(
        `
        SELECT
          COUNT(DISTINCT fq.id) as questions,
          COUNT(DISTINCT fa.id) as answers
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up."userId"
        LEFT JOIN forum_questions fq ON fq."authorId" = u.id AND fq."deletedAt" IS NULL
        LEFT JOIN forum_answers fa ON fa."authorId" = u.id AND fa."deletedAt" IS NULL
        WHERE (u.id = $1 OR LOWER(up.username) = LOWER($1) OR LOWER(up.username) = LOWER($2))
      `,
        [rawId, cleanUsername]
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

    // A suspension with a past suspendedUntil has expired — treat as not suspended.
    const isCurrentlySuspended =
      row.isSuspended && (row.suspendedUntil === null || new Date(row.suspendedUntil) > new Date());

    // Status: Suspended takes priority over Active/Inactive
    let status = "Inactive";
    if (isCurrentlySuspended) {
      status = "Suspended";
    } else if (row.isEmailVerified && row.profileComplete) {
      status = "Active";
    }

    // Verification status should be verified once email is verified
    const verificationStatus = row.isEmailVerified ? "verified" : (row.verificationStatus || "pending");

    return NextResponse.json({
      success: true,
      user: {
        ...row,
        roles,
        status,
        verificationStatus,
        isSuspended: isCurrentlySuspended,
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
    const rawId = decodeURIComponent(id).trim();
    const cleanUsername = rawId.replace(/^@+/, "").trim();
    const body = await request.json();
    const { action } = body;

    // Resolve real user UUID from id or username
    const userRes = await dbPool.query(
      `SELECT u.id FROM users u
       LEFT JOIN user_profiles up ON u.id = up."userId"
       WHERE (u.id = $1 OR LOWER(up.username) = LOWER($1) OR LOWER(up.username) = LOWER($2)) AND u."deletedAt" IS NULL
       LIMIT 1`,
      [rawId, cleanUsername]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }
    const realUserId = userRes.rows[0].id;

    if (action === "verify_email") {
      await dbPool.query(
        `UPDATE users SET "isEmailVerified" = true WHERE id = $1`,
        [realUserId]
      );
      await dbPool.query(
        `UPDATE user_profiles SET "verificationStatus" = 'verified', "updatedAt" = NOW() WHERE "userId" = $1`,
        [realUserId]
      );
    } else if (action === "suspend") {
      const { duration, reason, message } = body;
      const isPermanent = duration === "Permanent";
      const interval = isPermanent ? null : durationToInterval(duration || "30 days");
      const uuid = crypto.randomUUID();
      const suspensionReason = message || reason || null;

      // `users` is the source of truth read by user-svc's login/auth gate.
      if (isPermanent) {
        await dbPool.query(
          `UPDATE users SET "isSuspended" = true, "suspendedUntil" = NULL, "suspensionReason" = $2 WHERE id = $1`,
          [realUserId, suspensionReason]
        );
      } else {
        await dbPool.query(
          `UPDATE users SET "isSuspended" = true, "suspendedUntil" = NOW() + ($2::interval), "suspensionReason" = $3 WHERE id = $1`,
          [realUserId, interval, suspensionReason]
        );
      }

      // Keep forum_user_stats in sync too
      if (isPermanent) {
        await dbPool.query(
          `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
           VALUES ($1, $2, true, NULL)
           ON CONFLICT ("userId") DO UPDATE SET "isSuspended" = true, "suspendedUntil" = NULL`,
          [uuid, realUserId]
        );
      } else {
        await dbPool.query(
          `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
           VALUES ($1, $2, true, NOW() + ($3::interval))
           ON CONFLICT ("userId") DO UPDATE SET "isSuspended" = true, "suspendedUntil" = NOW() + ($3::interval)`,
          [uuid, realUserId, interval]
        );
      }

      await writeAudit({ userId: realUserId, action: "suspend", reason, message });
    } else if (action === "unsuspend") {
      await dbPool.query(
        `UPDATE users SET "isSuspended" = false, "suspendedUntil" = NULL, "suspensionReason" = NULL WHERE id = $1`,
        [realUserId]
      );
      await dbPool.query(
        `UPDATE forum_user_stats SET "isSuspended" = false, "suspendedUntil" = NULL WHERE "userId" = $1`,
        [realUserId]
      );
      await writeAudit({ userId: realUserId, action: "unsuspend" });
    } else if (action === "update") {
      const {
        fullName, username, phoneNo, gender, dob,
        addressLine1, streetArea, city, locationDistrict, state, pincode,
        roles,
        disabilityType, disabilitySince,
        carePersonName, careRelation, careDob, careDisabilityType,
        speciality, organization, yearsOfExperience,
        ngoName, ngoRole, district,
        verificationStatus,
      } = body;

      // 1. Update users table for name and phone
      if (fullName !== undefined && fullName !== null) {
        await dbPool.query(
          `UPDATE users SET name = $1 WHERE id = $2`,
          [fullName || "User", realUserId]
        );
      }
      if (phoneNo !== undefined) {
        await dbPool.query(
          `UPDATE users SET "phoneNo" = $1 WHERE id = $2`,
          [phoneNo || null, realUserId]
        );
      }

      // 2. Update roles on users table
      if (Array.isArray(roles)) {
        const VALID_ROLES = ["pwd", "caregiver", "therapist", "ngo", "volunteer", "student", "mentor"];
        const rolesArray = roles
          .map((r: string) => String(r).toLowerCase().trim())
          .filter((r) => VALID_ROLES.includes(r));
        try {
          await dbPool.query(
            `UPDATE users SET roles = $1::"Role"[] WHERE id = $2`,
            [rolesArray, realUserId]
          );
        } catch {
          await dbPool.query(
            `UPDATE users SET roles = $1 WHERE id = $2`,
            [rolesArray, realUserId]
          );
        }
      }

      // 3. Parse dates safely
      let dobDate: Date | null = null;
      if (dob) {
        const parsed = new Date(dob);
        if (!isNaN(parsed.getTime())) dobDate = parsed;
      }

      let careDobDate: Date | null = null;
      if (careDob) {
        const parsed = new Date(careDob);
        if (!isNaN(parsed.getTime())) careDobDate = parsed;
      }

      const parsedSince = disabilitySince ? parseInt(String(disabilitySince), 10) : null;
      const parsedExp = yearsOfExperience != null && String(yearsOfExperience).trim() !== ""
        ? parseInt(String(yearsOfExperience), 10)
        : null;
      const profileId = crypto.randomUUID();

      // 4. Upsert user_profiles with all columns
      await dbPool.query(
        `INSERT INTO user_profiles (
           id, "userId", username, "fullName", gender, dob,
           "addressLine1", "streetArea", city, "locationDistrict", state, pincode,
           "disabilityType", "disabilitySince",
           "carePersonName", "careRelation", "careDob", "careDisabilityType",
           speciality, organization, "yearsOfExperience",
           "ngoName", "ngoRole", district,
           "verificationStatus",
           "updatedAt"
         )
         VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12,
           $13, $14,
           $15, $16, $17, $18,
           $19, $20, $21,
           $22, $23, $24,
           $25,
           NOW()
         )
         ON CONFLICT ("userId") DO UPDATE SET
           username             = EXCLUDED.username,
           "fullName"           = EXCLUDED."fullName",
           gender               = EXCLUDED.gender,
           dob                  = EXCLUDED.dob,
           "addressLine1"       = EXCLUDED."addressLine1",
           "streetArea"         = EXCLUDED."streetArea",
           city                 = EXCLUDED.city,
           "locationDistrict"   = EXCLUDED."locationDistrict",
           state                = EXCLUDED.state,
           pincode              = EXCLUDED.pincode,
           "disabilityType"     = EXCLUDED."disabilityType",
           "disabilitySince"    = EXCLUDED."disabilitySince",
           "carePersonName"     = EXCLUDED."carePersonName",
           "careRelation"       = EXCLUDED."careRelation",
           "careDob"            = EXCLUDED."careDob",
           "careDisabilityType" = EXCLUDED."careDisabilityType",
           speciality           = EXCLUDED.speciality,
           organization         = EXCLUDED.organization,
           "yearsOfExperience"  = EXCLUDED."yearsOfExperience",
           "ngoName"            = EXCLUDED."ngoName",
           "ngoRole"            = EXCLUDED."ngoRole",
           district             = EXCLUDED.district,
           "verificationStatus" = COALESCE(EXCLUDED."verificationStatus", user_profiles."verificationStatus"),
           "updatedAt"          = NOW()`,
        [
          profileId,
          realUserId,
          username ? String(username).trim().toLowerCase() : null,
          fullName || null,
          gender || null,
          dobDate,
          addressLine1 || null,
          streetArea || null,
          city || null,
          locationDistrict || null,
          state || null,
          pincode || null,
          disabilityType || null,
          isNaN(parsedSince as number) ? null : parsedSince,
          carePersonName || null,
          careRelation || null,
          careDobDate,
          careDisabilityType || null,
          speciality || null,
          organization || null,
          isNaN(parsedExp as number) ? null : parsedExp,
          ngoName || null,
          ngoRole || null,
          district || null,
          verificationStatus || null,
        ]
      );

    } else {
      return NextResponse.json(
        { success: false, message: "Unknown action" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
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
    const rawId = decodeURIComponent(id).trim();
    const cleanUsername = rawId.replace(/^@+/, "").trim();

    // Resolve real user UUID from id or username
    const userRes = await dbPool.query(
      `SELECT u.id FROM users u
       LEFT JOIN user_profiles up ON u.id = up."userId"
       WHERE (u.id = $1 OR LOWER(up.username) = LOWER($1) OR LOWER(up.username) = LOWER($2)) AND u."deletedAt" IS NULL
       LIMIT 1`,
      [rawId, cleanUsername]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }
    const realUserId = userRes.rows[0].id;

    // Soft-delete: anonymise the user's PII and mark deleted
    await dbPool.query(
      `UPDATE users SET
         name = 'Deleted User',
         email = 'deleted_' || id || '@deleted.local',
         "phoneNo" = NULL,
         "isEmailVerified" = false,
         "profileComplete" = false,
         "deletedAt" = NOW()
       WHERE id = $1`,
      [realUserId]
    );

    // Also clear the profile so no PII remains visible
    await dbPool.query(
      `UPDATE user_profiles SET
         "fullName" = NULL, username = NULL, city = NULL, state = NULL,
         gender = NULL, dob = NULL, "disabilityType" = NULL, "addressLine1" = NULL,
         "streetArea" = NULL, pincode = NULL, "locationDistrict" = NULL
       WHERE "userId" = $1`,
      [realUserId]
    );

    await writeAudit({ userId: realUserId, action: "delete_user", reason: "admin deletion (soft-delete + PII scrub)" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
