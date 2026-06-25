import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

async function ensureEventsTable() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      image TEXT NOT NULL,
      description TEXT NOT NULL,
      spots INTEGER NOT NULL DEFAULT 50,
      "buttonType" TEXT NOT NULL DEFAULT 'filled',
      "externalUrl" TEXT NOT NULL DEFAULT '',
      organizer TEXT NOT NULL DEFAULT 'DigiAbility Admin',
      accessibility_tags TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Add new columns to existing tables gracefully
  await dbPool.query(`
    ALTER TABLE events
      ADD COLUMN IF NOT EXISTS organizer TEXT NOT NULL DEFAULT 'DigiAbility Admin',
      ADD COLUMN IF NOT EXISTS accessibility_tags TEXT NOT NULL DEFAULT ''
  `);
}

export async function GET() {
  try {
    await ensureEventsTable();
    const result = await dbPool.query(`
      SELECT * FROM events ORDER BY "createdAt" DESC
    `);
    
    return NextResponse.json({
      success: true,
      events: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureEventsTable();
    const body = await request.json();
    const { title, category, location, date, time, image, description, spots, buttonType, externalUrl, organizer, accessibilityTags } = body;

    if (!title || !category || !location || !date || !image || !description || !externalUrl) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const spotsNum = spots ? parseInt(spots, 10) : 50;

    const result = await dbPool.query(`
      INSERT INTO events (
        id, title, category, location, date, time, image, description,
        spots, "buttonType", "externalUrl", organizer, accessibility_tags,
        "createdAt", "updatedAt"
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
      RETURNING *
    `, [
      id, title, category, location, date,
      time || null, image, description,
      spotsNum, buttonType || "filled", externalUrl,
      organizer || "DigiAbility Admin",
      accessibilityTags || ""
    ]);
    
    return NextResponse.json({
      success: true,
      event: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to create event:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create event" },
      { status: 500 }
    );
  }
}
