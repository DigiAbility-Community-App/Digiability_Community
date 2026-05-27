import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

export async function GET() {
  try {
    const result = await dbPool.query(`
      SELECT * FROM events ORDER BY "createdAt" DESC
    `);
    
    return NextResponse.json({
      success: true,
      events: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, category, location, date, time, image, description, spots, buttonType, externalUrl } = body;
    
    if (!title || !category || !location || !date || !image || !description || !externalUrl) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }
    
    const id = crypto.randomUUID();
    const spotsNum = spots ? parseInt(spots, 10) : 50;

    const result = await dbPool.query(`
      INSERT INTO events (
        id, 
        title, 
        category, 
        location, 
        date, 
        time, 
        image, 
        description, 
        spots, 
        "buttonType", 
        "externalUrl", 
        "createdAt", 
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `, [
      id, 
      title, 
      category, 
      location, 
      date, 
      time || null, 
      image, 
      description, 
      spotsNum, 
      buttonType || "filled", 
      externalUrl
    ]);
    
    return NextResponse.json({
      success: true,
      event: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to create event:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create event" },
      { status: 500 }
    );
  }
}
