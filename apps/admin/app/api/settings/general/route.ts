import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { isValidIndianPhone, INVALID_PHONE_MESSAGE, isValidEmail, INVALID_EMAIL_MESSAGE } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

async function ensureTable() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS admin_general_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      platform_name TEXT DEFAULT 'DigiAbility Admin Portal',
      support_phone TEXT DEFAULT '+91 88000 12345',
      email_config TEXT DEFAULT 'admin@digiability.org',
      maintenance_mode BOOLEAN DEFAULT false,
      supported_languages JSONB DEFAULT '["English", "Hindi", "Marathi"]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ─────────────────────────────────────────────
// GET — load general settings
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTable();

    const result = await dbPool.query(
      `SELECT * FROM admin_general_settings WHERE id = 'default'`
    );

    if (result.rows.length === 0) {
      const inserted = await dbPool.query(`
        INSERT INTO admin_general_settings (id) VALUES ('default')
        ON CONFLICT (id) DO NOTHING
        RETURNING *
      `);
      const row =
        inserted.rows[0] ??
        (await dbPool.query(`SELECT * FROM admin_general_settings WHERE id = 'default'`)).rows[0];
      return NextResponse.json({ success: true, settings: formatRow(row) });
    }

    return NextResponse.json({ success: true, settings: formatRow(result.rows[0]) });
  } catch (error) {
    console.error("General settings GET error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST — save general settings
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTable();
    const body = await request.json();

    const platformName = body.platformName ?? "DigiAbility Admin Portal";
    const supportPhone = body.supportPhone ?? "+91 88000 12345";
    const emailConfig = body.emailConfig ?? "admin@digiability.org";
    const maintenanceMode = Boolean(body.maintenanceMode);
    const supportedLanguages = Array.isArray(body.supportedLanguages)
      ? JSON.stringify(body.supportedLanguages)
      : '["English", "Hindi", "Marathi"]';

    // Enforce server-side too — the client check is UX, this is the guard.
    if (!isValidIndianPhone(supportPhone)) {
      return NextResponse.json({ success: false, message: INVALID_PHONE_MESSAGE }, { status: 400 });
    }
    if (!isValidEmail(emailConfig)) {
      return NextResponse.json({ success: false, message: INVALID_EMAIL_MESSAGE }, { status: 400 });
    }

    const result = await dbPool.query(
      `
      INSERT INTO admin_general_settings (
        id, platform_name, support_phone, email_config, maintenance_mode, supported_languages, updated_at
      ) VALUES (
        'default', $1, $2, $3, $4, $5::jsonb, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        platform_name       = EXCLUDED.platform_name,
        support_phone       = EXCLUDED.support_phone,
        email_config        = EXCLUDED.email_config,
        maintenance_mode    = EXCLUDED.maintenance_mode,
        supported_languages = EXCLUDED.supported_languages,
        updated_at          = NOW()
      RETURNING *
    `,
      [platformName, supportPhone, emailConfig, maintenanceMode, supportedLanguages]
    );

    await writeAudit({
      action: "update_general_settings",
      reason: `maintenance_mode=${maintenanceMode}`,
    });

    return NextResponse.json({ success: true, settings: formatRow(result.rows[0]) });
  } catch (error) {
    console.error("General settings POST error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

function formatRow(row: any) {
  if (!row) return null;
  return {
    platformName: row.platform_name,
    supportPhone: row.support_phone,
    emailConfig: row.email_config,
    maintenanceMode: Boolean(row.maintenance_mode),
    supportedLanguages: Array.isArray(row.supported_languages)
      ? row.supported_languages
      : typeof row.supported_languages === "string"
      ? JSON.parse(row.supported_languages)
      : ["English", "Hindi", "Marathi"],
    updatedAt: row.updated_at,
  };
}
