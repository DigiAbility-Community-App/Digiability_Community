import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { isValidLocation, INVALID_LOCATION_MESSAGE } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await dbPool.query(`SELECT * FROM events WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error("Failed to fetch event:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, category, location, date, time, image, description, spots, buttonType, externalUrl, organizer, accessibilityTags, status } = body;

    if (location !== undefined && !isValidLocation(location)) {
      return NextResponse.json(
        { success: false, message: INVALID_LOCATION_MESSAGE },
        { status: 400 }
      );
    }

    const result = await dbPool.query(`
      UPDATE events SET
        title = COALESCE($1, title),
        category = COALESCE($2, category),
        location = COALESCE($3, location),
        date = COALESCE($4, date),
        time = $5,
        image = COALESCE($6, image),
        description = COALESCE($7, description),
        spots = COALESCE($8, spots),
        "buttonType" = COALESCE($9, "buttonType"),
        "externalUrl" = COALESCE($10, "externalUrl"),
        organizer = COALESCE($11, organizer),
        accessibility_tags = COALESCE($12, accessibility_tags),
        status = COALESCE($13, status),
        "updatedAt" = NOW()
      WHERE id = $14
      RETURNING *
    `, [
      title, category, location, date, time ?? null,
      image, description, spots ? parseInt(spots, 10) : null,
      buttonType, externalUrl, organizer, accessibilityTags,
      status, id
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, event: result.rows[0] });
  } catch (error) {
    console.error("Failed to update event:", error);
    return NextResponse.json({ success: false, message: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, message: "Missing event ID" }, { status: 400 });
    }

    await dbPool.query(`DELETE FROM events WHERE id = $1`, [id]);
    return NextResponse.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return NextResponse.json({ success: false, message: "Failed to delete event" }, { status: 500 });
  }
}
