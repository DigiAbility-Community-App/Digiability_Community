import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";

// ─────────────────────────────────────────────────────
// Admin grievance queue — proxies to user-svc.
//
// Grievance redressal is required by IT Rules 2021 Rule 3(2). Terms §15
// publishes acknowledgement within 24 hours and resolution within 15 days;
// user-svc computes the SLA state so the queue can surface breaches.
// ─────────────────────────────────────────────────────

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
    const status = searchParams.get("status") ?? "ALL";
    const res = await fetch(
      `${USER_SVC}/api/moderation/grievances?status=${encodeURIComponent(status)}`,
      { headers: internalHeaders(), cache: "no-store" }
    );
    const data = (await res.json()) as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, message: "Failed to load grievances" },
      { status: 500 }
    );
  }
}
