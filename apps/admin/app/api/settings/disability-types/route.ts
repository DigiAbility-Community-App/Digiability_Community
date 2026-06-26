import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

// Ensure table exists on every cold start
async function ensureTable() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS disability_types (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Active',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Seed defaults if table is empty
  const { rows } = await dbPool.query(`SELECT COUNT(*) as cnt FROM disability_types`);
  if (Number(rows[0].cnt) === 0) {
    await dbPool.query(`
      INSERT INTO disability_types (name, code) VALUES
        ('Visual Impairment','DIS-001'),
        ('Locomotor Disability','DIS-002'),
        ('Hearing Impairment','DIS-003'),
        ('Intellectual Disability','DIS-004'),
        ('Autism Spectrum','DIS-005'),
        ('Speech & Language','DIS-006'),
        ('Physical Disability','DIS-007'),
        ('Mental Health','DIS-008'),
        ('Learning Disability','DIS-009'),
        ('Multiple Disabilities','DIS-010')
      ON CONFLICT (code) DO NOTHING
    `);
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    await ensureTable();
    const { rows } = await dbPool.query(
      `SELECT id, code, name, status FROM disability_types ORDER BY code`
    );
    return NextResponse.json({ success: true, types: rows });
  } catch (error) {
    console.error("GET disability-types error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable();
    const { name, status = "Active" } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 });
    }
    // Auto-generate code: DIS-XXX (use MAX to avoid timestamp-ordering collisions)
    const { rows: maxRow } = await dbPool.query(
      `SELECT MAX(CAST(SUBSTRING(code FROM 'DIS-(\\d+)') AS INTEGER)) AS max_num FROM disability_types`
    );
    const nextNum = (maxRow[0].max_num ?? 0) + 1;
    const code = `DIS-${String(nextNum).padStart(3, "0")}`;
    const { rows } = await dbPool.query(
      `INSERT INTO disability_types (name, code, status) VALUES ($1, $2, $3)
       RETURNING id, code, name, status`,
      [name.trim(), code, status]
    );
    return NextResponse.json({ success: true, type: rows[0] });
  } catch (error) {
    console.error("POST disability-types error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureTable();
    const { id, name, status } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }
    const { rows } = await dbPool.query(
      `UPDATE disability_types
       SET name = COALESCE($1, name),
           status = COALESCE($2, status),
           "updatedAt" = NOW()
       WHERE id = $3
       RETURNING id, code, name, status`,
      [name ?? null, status ?? null, id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, type: rows[0] });
  } catch (error) {
    console.error("PATCH disability-types error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTable();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }
    await dbPool.query(`DELETE FROM disability_types WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE disability-types error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
