import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

export async function GET() {
  try {
    const result = await dbPool.query(
      `SELECT maintenance_mode FROM admin_general_settings WHERE id = 'default'`
    );
    const inMaintenance =
      result.rows.length > 0 ? Boolean(result.rows[0].maintenance_mode) : false;
    return NextResponse.json({ success: true, inMaintenance });
  } catch {
    return NextResponse.json({ success: true, inMaintenance: false });
  }
}
