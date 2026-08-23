import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await dbPool.query(`SELECT * FROM services WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Service not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, service: result.rows[0] });
  } catch (error) {
    console.error("Failed to fetch service:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch service" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      availability,
      verified,
      status,
    } = body;

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
        verified = COALESCE($13, verified),
        status = COALESCE($14, status),
        "updatedAt" = NOW()
      WHERE id = $15
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
