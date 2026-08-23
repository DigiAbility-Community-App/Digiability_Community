import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

export async function GET() {
  try {
    const result = await dbPool.query(
      `SELECT maintenance_mode, support_phone, email_config, platform_name FROM admin_general_settings WHERE id = 'default'`
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return NextResponse.json({
        success: true,
        inMaintenance: Boolean(row.maintenance_mode),
        supportPhone: row.support_phone || "+91 88000 12345",
        supportEmail: row.email_config || "support@digiability.org",
        platformName: row.platform_name || "DigiAbility",
      });
    }
    return NextResponse.json({
      success: true,
      inMaintenance: false,
      supportPhone: "+91 88000 12345",
      supportEmail: "support@digiability.org",
      platformName: "DigiAbility",
    });
  } catch {
    return NextResponse.json({
      success: true,
      inMaintenance: false,
      supportPhone: "+91 88000 12345",
      supportEmail: "support@digiability.org",
      platformName: "DigiAbility",
    });
  }
}
