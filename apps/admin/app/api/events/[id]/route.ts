import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing event ID" },
        { status: 400 }
      );
    }
    
    await dbPool.query(
      `DELETE FROM events WHERE id = $1`,
      [id]
    );
    
    return NextResponse.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete event" },
      { status: 500 }
    );
  }
}
