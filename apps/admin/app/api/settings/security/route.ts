import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, getAdminSession, getRequestIp } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { DEFAULT_IDLE_MINUTES } from "@/lib/session";

async function ensureTable() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS admin_security_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      two_fa_enabled BOOLEAN DEFAULT true,
      min_password_len INT DEFAULT 12,
      max_password_len INT DEFAULT 16,
      require_uppercase BOOLEAN DEFAULT true,
      require_numbers BOOLEAN DEFAULT true,
      require_special BOOLEAN DEFAULT true,
      max_failed_attempts INT DEFAULT 5,
      lockout_duration_mins INT DEFAULT 15,
      session_timeout_mins INT DEFAULT 480,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE admin_security_settings ADD COLUMN IF NOT EXISTS max_password_len INT DEFAULT 16;
    ALTER TABLE admin_security_settings ALTER COLUMN session_timeout_mins SET DEFAULT 480;
  `);

  // None of the values below was ever a deliberate choice: 1440 was the dead
  // column default from when nothing read this setting, 30 came from the
  // migration that replaced it, and 120 was the previous default. There is
  // still no Settings UI field for the timeout and the POST handler below
  // doesn't persist this column, so no admin has ever been able to pick a
  // value — anything matching these is a stale default, safe to move up to the
  // current DEFAULT_IDLE_MINUTES (8 hours).
  await dbPool.query(
    `UPDATE admin_security_settings
     SET session_timeout_mins = $1
     WHERE id = 'default' AND session_timeout_mins IN (1440, 30, 120)`,
    [DEFAULT_IDLE_MINUTES]
  );
}

// ─────────────────────────────────────────────
// GET — load security settings
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTable();

    const result = await dbPool.query(
      `SELECT * FROM admin_security_settings WHERE id = 'default'`
    );

    if (result.rows.length === 0) {
      const inserted = await dbPool.query(`
        INSERT INTO admin_security_settings (id) VALUES ('default')
        ON CONFLICT (id) DO NOTHING
        RETURNING *
      `);
      const row =
        inserted.rows[0] ??
        (await dbPool.query(`SELECT * FROM admin_security_settings WHERE id = 'default'`)).rows[0];
      return NextResponse.json({ success: true, settings: formatRow(row) });
    }

    return NextResponse.json({ success: true, settings: formatRow(result.rows[0]) });
  } catch (error) {
    console.error("Security settings GET error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST — save security settings
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;
  // Actor identity for the audit trail — see lib/audit.ts.
  const actor = await getAdminSession(request);
  const ip = getRequestIp(request);

  try {
    await ensureTable();
    const body = await request.json();

    const twoFa = Boolean(body.twoFa);
    const minLen = Math.max(8, Math.min(parseInt(body.minLen ?? "12", 10), 16));
    const maxLen = Math.max(minLen, Math.min(parseInt(body.maxLen ?? "16", 10), 16));
    const upperCase = Boolean(body.upperCase);
    const numbers = Boolean(body.numbers);
    const special = Boolean(body.special);
    const maxAttempts = Math.max(1, Math.min(parseInt(body.maxAttempts ?? "5", 10), 20));
    const lockout = Math.max(1, Math.min(parseInt(body.lockout ?? "15", 10), 1440));

    const result = await dbPool.query(
      `
      INSERT INTO admin_security_settings (
        id, two_fa_enabled, min_password_len, max_password_len, require_uppercase, require_numbers,
        require_special, max_failed_attempts, lockout_duration_mins, updated_at
      ) VALUES (
        'default', $1, $2, $3, $4, $5, $6, $7, $8, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        two_fa_enabled        = EXCLUDED.two_fa_enabled,
        min_password_len      = EXCLUDED.min_password_len,
        max_password_len      = EXCLUDED.max_password_len,
        require_uppercase     = EXCLUDED.require_uppercase,
        require_numbers       = EXCLUDED.require_numbers,
        require_special       = EXCLUDED.require_special,
        max_failed_attempts   = EXCLUDED.max_failed_attempts,
        lockout_duration_mins = EXCLUDED.lockout_duration_mins,
        updated_at            = NOW()
      RETURNING *
    `,
      [twoFa, minLen, maxLen, upperCase, numbers, special, maxAttempts, lockout]
    );

    await writeAudit({ adminEmail: actor?.email, ipAddress: ip,
      action: "update_security_policy",
      reason: `min_len=${minLen}, max_len=${maxLen}, max_attempts=${maxAttempts}, 2fa=${twoFa}`,
    });

    return NextResponse.json({ success: true, settings: formatRow(result.rows[0]) });
  } catch (error) {
    console.error("Security settings POST error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

function formatRow(row: any) {
  if (!row) return null;
  return {
    twoFa: Boolean(row.two_fa_enabled),
    minLen: row.min_password_len ?? 12,
    maxLen: row.max_password_len ?? 16,
    upperCase: Boolean(row.require_uppercase),
    numbers: Boolean(row.require_numbers),
    special: Boolean(row.require_special),
    maxAttempts: String(row.max_failed_attempts ?? 5),
    lockout: String(row.lockout_duration_mins ?? 15),
    sessionTimeout: String(row.session_timeout_mins ?? DEFAULT_IDLE_MINUTES),
    updatedAt: row.updated_at,
  };
}
