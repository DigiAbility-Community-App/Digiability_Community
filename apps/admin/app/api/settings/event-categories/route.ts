import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { generateCategoryId } from "@/lib/categoryId";
import { ensureEventCategoriesTable as ensureTable } from "@/lib/masterCategories";

// ─────────────────────────────────────────────
// GET — list all event categories
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const result = await dbPool.query(
      `SELECT id, name, status, created_at FROM event_categories ORDER BY name ASC`
    );
    return NextResponse.json({ success: true, categories: result.rows });
  } catch (error) {
    console.error("Event categories GET error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch event categories" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST — create event category
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

    const id = await generateCategoryId("event_categories", "EV");
    const result = await dbPool.query(
      `
      INSERT INTO event_categories (id, name, status, created_at)
      VALUES ($1, $2, 'Active', NOW())
      ON CONFLICT (name) DO UPDATE SET status = 'Active'
      RETURNING *
    `,
      [id, name]
    );

    await writeAudit({
      action: "create_event_category",
      reason: `Added category "${name}"`,
    });

    return NextResponse.json({ success: true, category: result.rows[0] });
  } catch (error: any) {
    console.error("Event categories POST error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create category" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PATCH — edit event category name or toggle status
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
      UPDATE event_categories
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
      action: "update_event_category",
      reason: `Updated category "${result.rows[0].name}" (${status ? `status=${status}` : `name=${name}`})`,
    });

    return NextResponse.json({ success: true, category: result.rows[0] });
  } catch (error: any) {
    console.error("Event categories PATCH error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update category" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// DELETE — remove event category
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

    const prev = await dbPool.query(`SELECT name FROM event_categories WHERE id = $1`, [id]);
    const catName = prev.rows[0]?.name || id;

    await dbPool.query(`DELETE FROM event_categories WHERE id = $1`, [id]);

    await writeAudit({
      action: "delete_event_category",
      reason: `Deleted category "${catName}"`,
    });

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("Event categories DELETE error:", error);
    return NextResponse.json({ success: false, message: "Failed to delete category" }, { status: 500 });
  }
}
