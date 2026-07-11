import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";

// ─────────────────────────────────────────────────────
// Admin keyword API — proxies to user-svc
// All writes flow through user-svc so the Redis cache
// and pub/sub invalidation are handled in one place.
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
    const category = searchParams.get("category") ?? "";
    const isActive = searchParams.get("isActive") ?? "";

    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (isActive) qs.set("isActive", isActive);

    const res = await fetch(
      `${USER_SVC}/api/moderation/keywords${qs.size > 0 ? `?${qs}` : ""}`,
      { headers: internalHeaders(), cache: "no-store" }
    );
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to fetch keywords" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json() as Record<string, unknown>;
    // Attach admin identity for audit trail
    const session = request.cookies.get("admin-session");
    const createdBy = session ? "admin" : undefined;

    const res = await fetch(`${USER_SVC}/api/moderation/keywords`, {
      method: "POST",
      headers: internalHeaders(),
      body: JSON.stringify({ ...body, createdBy }),
    });
    const data = await res.json() as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to create keyword" }, { status: 500 });
  }
}
