import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { generateCategoryId } from "@/lib/categoryId";
import { ensureServiceCategoriesTable as ensureTable } from "@/lib/masterCategories";

// ─────────────────────────────────────────────
// GET — list all service categories
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const result = await dbPool.query(
      `SELECT id, name, status, created_at FROM service_categories ORDER BY name ASC`
    );
    return NextResponse.json({ success: true, categories: result.rows });
  } catch (error) {
    console.error("Service categories GET error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch service categories" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST — create service category
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTable();
    const body = await request.json();
    const name = (body.name || "").trim();

    if (!name) {
      return NextResponse.json({ success: false, message: "Category name is required" }, { status: 400 });
    }

    const id = await generateCategoryId("service_categories", "SV");
    const result = await dbPool.query(
      `
      INSERT INTO service_categories (id, name, status, created_at)
      VALUES ($1, $2, 'Active', NOW())
      ON CONFLICT (name) DO UPDATE SET status = 'Active'
      RETURNING *
    `,
      [id, name]
    );

    await writeAudit({
      action: "create_service_category",
      reason: `Added service category "${name}"`,
    });

    return NextResponse.json({ success: true, category: result.rows[0] });
  } catch (error: any) {
    console.error("Service categories POST error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create service category" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PATCH — edit service category name or toggle status
// ─────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTable();
    const body = await request.json();
    const { id, name, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Category ID is required" }, { status: 400 });
    }

    const result = await dbPool.query(
      `
      UPDATE service_categories
      SET
        name = COALESCE($1, name),
        status = COALESCE($2, status)
      WHERE id = $3
      RETURNING *
    `,
      [name ? name.trim() : null, status ?? null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Category not found" }, { status: 404 });
    }

    await writeAudit({
      action: "update_service_category",
      reason: `Updated service category "${result.rows[0].name}" (${status ? `status=${status}` : `name=${name}`})`,
    });

    return NextResponse.json({ success: true, category: result.rows[0] });
  } catch (error: any) {
    console.error("Service categories PATCH error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update category" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// DELETE — remove service category
// ─────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTable();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Category ID is required" }, { status: 400 });
    }

    const prev = await dbPool.query(`SELECT name FROM service_categories WHERE id = $1`, [id]);
    const catName = prev.rows[0]?.name || id;

    await dbPool.query(`DELETE FROM service_categories WHERE id = $1`, [id]);

    await writeAudit({
      action: "delete_service_category",
      reason: `Deleted service category "${catName}"`,
    });

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("Service categories DELETE error:", error);
    return NextResponse.json({ success: false, message: "Failed to delete category" }, { status: 500 });
  }
}
