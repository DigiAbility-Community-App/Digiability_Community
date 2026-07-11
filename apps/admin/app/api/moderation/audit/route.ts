import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";

const USER_SVC = process.env.USER_SVC_URL ?? "http://localhost:4001";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

function internalHeaders() {
  return {
    "Content-Type": "application/json",
    "x-internal-secret": INTERNAL_SECRET,
    "x-internal-ts": String(Date.now()),
  };
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ?? "50";
    const offset = searchParams.get("offset") ?? "0";

    const res = await fetch(
      `${USER_SVC}/api/moderation/audit?limit=${limit}&offset=${offset}`,
      { headers: internalHeaders(), cache: "no-store" }
    );
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to fetch audit log" }, { status: 500 });
  }
}
