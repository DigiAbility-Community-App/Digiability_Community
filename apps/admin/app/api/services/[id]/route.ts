import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, isAdminRequest } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { isValidIndianPhone, INVALID_PHONE_MESSAGE } from "@/lib/validation";
import { isValidWeeklySchedule, formatAvailabilitySummary } from "@/lib/availabilitySchedule";

// Public for a published service (mobile detail view); a draft is only
// visible to a logged-in admin — treated as 404 for anyone else, same as a
// nonexistent id, so drafts don't even reveal their existence.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await dbPool.query(`SELECT * FROM services WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Service not found" }, { status: 404 });
    }

    const service = result.rows[0];
    if (service.status !== "published" && !(await isAdminRequest(request))) {
      return NextResponse.json({ success: false, message: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, service });
  } catch (error) {
    console.error("Failed to fetch service:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch service" }, { status: 500 });
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
    const {
      name,
      type,
      category,
      logo,
      image,
      description,
      location,
      contactPhone,
      contactEmail,
      contactUrl,
      price,
      availabilitySchedule,
      verified,
      status,
    } = body;

    if (contactPhone !== undefined && !isValidIndianPhone(contactPhone)) {
      return NextResponse.json(
        { success: false, message: INVALID_PHONE_MESSAGE },
        { status: 400 }
      );
    }

    if (availabilitySchedule !== undefined && !isValidWeeklySchedule(availabilitySchedule)) {
      return NextResponse.json(
        { success: false, message: "Invalid availability schedule — every open day needs both a From and To time." },
        { status: 400 }
      );
    }
    const availability = availabilitySchedule !== undefined
      ? formatAvailabilitySummary(availabilitySchedule)
      : undefined;

    const result = await dbPool.query(`
      UPDATE services SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        category = COALESCE($3, category),
        logo = COALESCE($4, logo),
        image = COALESCE($5, image),
        description = COALESCE($6, description),
        location = COALESCE($7, location),
        "contactPhone" = COALESCE($8, "contactPhone"),
        "contactEmail" = COALESCE($9, "contactEmail"),
        "contactUrl" = COALESCE($10, "contactUrl"),
        price = COALESCE($11, price),
        availability = COALESCE($12, availability),
        "availabilitySchedule" = COALESCE($13, "availabilitySchedule"),
        verified = COALESCE($14, verified),
        status = COALESCE($15, status),
        "updatedAt" = NOW()
      WHERE id = $16
      RETURNING *
    `, [
      name,
      type,
      category,
      logo,
      image,
      description,
      location,
      contactPhone,
      contactEmail,
      contactUrl,
      price,
      availability,
      availabilitySchedule !== undefined ? JSON.stringify(availabilitySchedule) : undefined,
      verified,
      status,
      id,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Service not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, service: result.rows[0] });
  } catch (error) {
    console.error("Failed to update service:", error);
    return NextResponse.json({ success: false, message: "Failed to update service" }, { status: 500 });
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
    const result = await dbPool.query(`DELETE FROM services WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Service not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    console.error("Failed to delete service:", error);
    return NextResponse.json({ success: false, message: "Failed to delete service" }, { status: 500 });
  }
}
