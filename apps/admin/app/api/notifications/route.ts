import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

async function ensureTables() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS admin_notification_logs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50),
      audience VARCHAR(50),
      sent_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ─────────────────────────────────────────────
// GET — broadcast history
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTables();
    const result = await dbPool.query(`
      SELECT id, title, message, type, audience, sent_count, created_at
      FROM admin_notification_logs
      ORDER BY created_at DESC LIMIT 50
    `);

    return NextResponse.json({
      success: true,
      logs: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        type: row.type,
        audience: row.audience,
        sentCount: row.sent_count,
        sentAt: new Date(row.created_at).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        }),
      })),
    });
  } catch (error) {
    console.error("Notification GET error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// POST — send broadcast to users
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTables();
    const body = await request.json();
    const title   = (body.title   ?? "").toString().trim().slice(0, 200);
    const message = (body.message ?? "").toString().trim().slice(0, 2000);
    const type    = (body.type    ?? "INFO").toString();
    const audience = (body.audience ?? "ALL").toString();

    if (!title || !message) {
      return NextResponse.json(
        { success: false, message: "Title and message are required" },
        { status: 400 }
      );
    }

    const notifType = `ADMIN_${type.toUpperCase()}`;

    // Insert one notification row per target user using a SELECT-based INSERT.
    // gen_random_uuid()::text handles the id column (no DB-level default).
    let insertResult;
    if (audience === "ALL") {
      insertResult = await dbPool.query(`
        INSERT INTO forum_notifications (id, "userId", type, title, message, read, "createdAt")
        SELECT gen_random_uuid()::text, id, $1, $2, $3, false, NOW()
        FROM users
        WHERE "deletedAt" IS NULL
      `, [notifType, title, message]);
    } else {
      // audience is a role value like "pwd", "caregiver", etc.
      insertResult = await dbPool.query(`
        INSERT INTO forum_notifications (id, "userId", type, title, message, read, "createdAt")
        SELECT gen_random_uuid()::text, id, $1, $2, $3, false, NOW()
        FROM users
        WHERE "deletedAt" IS NULL
          AND $4 = ANY(roles::text[])
      `, [notifType, title, message, audience.toLowerCase()]);
    }

    const sentCount = insertResult.rowCount ?? 0;

    if (sentCount === 0) {
      return NextResponse.json(
        { success: false, message: "No users found for this audience" },
        { status: 404 }
      );
    }

    // Log the broadcast
    await dbPool.query(`
      INSERT INTO admin_notification_logs (title, message, type, audience, sent_count)
      VALUES ($1, $2, $3, $4, $5)
    `, [title, message, type, audience, sentCount]);

    return NextResponse.json({ success: true, sentTo: sentCount });
  } catch (error) {
    console.error("Notification POST error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
