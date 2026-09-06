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

    // Report a duplicate name as a conflict. The previous ON CONFLICT (name)
    // DO UPDATE quietly turned a duplicate insert into an update, so the UI
    // saw "success" while nothing was added — indistinguishable from a no-op.
    const dupe = await dbPool.query(
      `SELECT id FROM service_categories WHERE LOWER(name) = LOWER($1)`,
      [name]
    );
    if (dupe.rows.length > 0) {
      return NextResponse.json(
        { success: false, message: `A category named "${name}" already exists.` },
        { status: 409 }
      );
    }

    // generateCategoryId returns the next free id, but two concurrent creates
    // can still pick the same one — retry rather than surfacing a raw 23505.
    let created: any = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const id = await generateCategoryId("service_categories", "SV");
      try {
        const result = await dbPool.query(
          `
          INSERT INTO service_categories (id, name, status, created_at)
          VALUES ($1, $2, 'Active', NOW())
          RETURNING *
        `,
          [id, name]
        );
        created = result.rows[0];
      } catch (err: any) {
        if (err?.code !== "23505") throw err;
        // Lost a race on the name; the category now exists either way.
        if (String(err.constraint || err.detail || "").includes("name")) {
          return NextResponse.json(
            { success: false, message: `A category named "${name}" already exists.` },
            { status: 409 }
          );
        }
        // Otherwise the id was taken — loop and allocate the next one.
      }
    }

    if (!created) {
      return NextResponse.json(
        { success: false, message: "Could not allocate a category id. Please try again." },
        { status: 409 }
      );
    }

    await writeAudit({
      action: "create_service_category",
      reason: `Added service category "${name}"`,
    });

    return NextResponse.json({ success: true, category: created });
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
    if (prev.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Category not found" }, { status: 404 });
    }
    const catName = prev.rows[0].name;

    // Services reference categories by id, so deleting one that is still in use
    // would leave those rows pointing at an id that no longer exists — they'd
    // silently vanish from every category filter in the app.
    const refTable = await dbPool.query(`SELECT to_regclass('services') AS oid`);
    if (refTable.rows[0]?.oid !== null) {
      const inUse = await dbPool.query(
        `SELECT COUNT(*)::int AS count FROM services WHERE category = $1`,
        [id]
      );
      const count = inUse.rows[0]?.count ?? 0;
      if (count > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `"${catName}" is still used by ${count} service${count === 1 ? "" : "s"}. Reassign ${count === 1 ? "it" : "them"} to another category first.`,
          },
          { status: 409 }
        );
      }
    }

    await dbPool.query(`DELETE FROM service_categories WHERE id = $1`, [id]);

    await writeAudit({
      action: "delete_service_category",
      reason: `Deleted service category "${catName}"`,
    });

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    console.error("Service categories DELETE error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete category" },
      { status: 500 }
    );
  }
}
