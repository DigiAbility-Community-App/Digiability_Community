import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

async function ensureTable() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS admin_notification_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      email_new_users BOOLEAN DEFAULT true,
      email_content_reports BOOLEAN DEFAULT true,
      email_failed_transactions BOOLEAN DEFAULT true,
      email_system_errors BOOLEAN DEFAULT true,
      email_weekly_digest BOOLEAN DEFAULT true,
      push_enabled BOOLEAN DEFAULT true,
      push_moderation_queue BOOLEAN DEFAULT true,
      push_user_milestones BOOLEAN DEFAULT true,
      push_community_highlights BOOLEAN DEFAULT true,
      push_system_maintenance BOOLEAN DEFAULT true,
      sms_critical_only BOOLEAN DEFAULT true,
      sms_daily_summary BOOLEAN DEFAULT true,
      sms_promotional BOOLEAN DEFAULT false,
      phone_number TEXT DEFAULT '',
      frequency TEXT DEFAULT 'Real-time',
      quiet_start TEXT DEFAULT '20:00',
      quiet_end TEXT DEFAULT '08:00',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ─────────────────────────────────────────────
// GET — load settings
// ─────────────────────────────────────────────
export async function GET() {
  try {
    await ensureTable();

    const result = await dbPool.query(
      `SELECT * FROM admin_notification_settings WHERE id = 'default'`
    );

    if (result.rows.length === 0) {
      // Insert defaults and return them
      const inserted = await dbPool.query(`
        INSERT INTO admin_notification_settings (id) VALUES ('default')
        ON CONFLICT (id) DO NOTHING
        RETURNING *
      `);
      const row = inserted.rows[0] ?? (await dbPool.query(`SELECT * FROM admin_notification_settings WHERE id = 'default'`)).rows[0];
      return NextResponse.json({ success: true, settings: row });
    }

    return NextResponse.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    console.error("Notification settings GET error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST — save settings
// ─────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await ensureTable();
    const body = await request.json();

    await dbPool.query(`
      INSERT INTO admin_notification_settings (
        id,
        email_new_users, email_content_reports, email_failed_transactions,
        email_system_errors, email_weekly_digest,
        push_enabled, push_moderation_queue, push_user_milestones,
        push_community_highlights, push_system_maintenance,
        sms_critical_only, sms_daily_summary, sms_promotional,
        phone_number, frequency, quiet_start, quiet_end,
        updated_at
      ) VALUES (
        'default',
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        email_new_users          = EXCLUDED.email_new_users,
        email_content_reports    = EXCLUDED.email_content_reports,
        email_failed_transactions= EXCLUDED.email_failed_transactions,
        email_system_errors      = EXCLUDED.email_system_errors,
        email_weekly_digest      = EXCLUDED.email_weekly_digest,
        push_enabled             = EXCLUDED.push_enabled,
        push_moderation_queue    = EXCLUDED.push_moderation_queue,
        push_user_milestones     = EXCLUDED.push_user_milestones,
        push_community_highlights= EXCLUDED.push_community_highlights,
        push_system_maintenance  = EXCLUDED.push_system_maintenance,
        sms_critical_only        = EXCLUDED.sms_critical_only,
        sms_daily_summary        = EXCLUDED.sms_daily_summary,
        sms_promotional          = EXCLUDED.sms_promotional,
        phone_number             = EXCLUDED.phone_number,
        frequency                = EXCLUDED.frequency,
        quiet_start              = EXCLUDED.quiet_start,
        quiet_end                = EXCLUDED.quiet_end,
        updated_at               = NOW()
    `, [
      body.emailNewUsers         ?? true,
      body.emailContentReports   ?? true,
      body.emailFailedTransactions ?? true,
      body.emailSystemErrors     ?? true,
      body.emailWeeklyDigest     ?? true,
      body.pushEnabled           ?? true,
      body.pushModerationQueue   ?? true,
      body.pushUserMilestones    ?? true,
      body.pushCommunityHighlights ?? true,
      body.pushSystemMaintenance ?? true,
      body.smsCriticalOnly       ?? true,
      body.smsDailySummary       ?? true,
      body.smsPromotional        ?? false,
      body.phoneNumber           ?? '',
      body.frequency             ?? 'Real-time',
      body.quietStart            ?? '20:00',
      body.quietEnd              ?? '08:00',
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification settings POST error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
