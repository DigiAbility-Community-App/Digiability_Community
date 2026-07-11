import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { verifyJWT } from "@/lib/jwt";

// ─────────────────────────────────────────────────────
// Unified Review Queue API (Tier E)
//
// GET  — returns merged list of UserReports + ModerationFlags
//        sorted by createdAt DESC, filterable by status and type
//
// POST — execute a review action on a queue item:
//        dismiss | remove_content | warn_user | ban_user
//        Every action writes an audit log entry.
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

/** Extract admin email from the session cookie for audit logging. */
async function getAdminEmail(request: NextRequest): Promise<string> {
  const token = request.cookies.get("admin-session")?.value;
  if (!token) return "unknown-admin";
  const secret = process.env.JWT_SECRET ?? "";
  const payload = await verifyJWT(token, secret).catch(() => null);
  return typeof payload?.email === "string" ? payload.email : "unknown-admin";
}

/** Write one audit log entry via user-svc. Fire-and-forget. */
function writeAudit(
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  reason?: string,
  detail?: Record<string, unknown>
): void {
  fetch(`${USER_SVC}/api/moderation/audit`, {
    method: "POST",
    headers: internalHeaders(),
    body: JSON.stringify({ adminEmail, action, targetType, targetId, reason, detail: detail ? JSON.stringify(detail) : undefined }),
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────
// GET — unified review queue
// ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "PENDING";
  const type = searchParams.get("type") ?? "all"; // all | report | flag

  try {
    const [reportsRes, flagsRes] = await Promise.all([
      type !== "flag"
        ? fetch(`${USER_SVC}/api/moderation/reports?status=${status}&limit=50`, {
            headers: internalHeaders(), cache: "no-store",
          }).then((r) => r.json() as Promise<{ success: boolean; data?: { reports: unknown[] } }>)
        : Promise.resolve({ success: true, data: { reports: [] } }),
      type !== "report"
        ? fetch(`${USER_SVC}/api/moderation/flags?status=${status}&limit=50`, {
            headers: internalHeaders(), cache: "no-store",
          }).then((r) => r.json() as Promise<{ success: boolean; data?: { flags: unknown[] } }>)
        : Promise.resolve({ success: true, data: { flags: [] } }),
    ]);

    type RawReport = {
      id: string; targetType: string; targetId: string; reason: string; details?: string;
      status: string; createdAt: string;
      reporter?: { id: string; name: string; email: string } | null;
    };
    type RawFlag = {
      id: string; contentType: string; contentId: string; userId: string; text?: string;
      score: number; categories: string[]; status: string; provider: string; createdAt: string;
    };

    const reports: RawReport[] = Array.isArray((reportsRes as any).data?.reports)
      ? (reportsRes as any).data.reports
      : [];
    const flags: RawFlag[] = Array.isArray((flagsRes as any).data?.flags)
      ? (flagsRes as any).data.flags
      : [];

    // Normalise to a unified shape
    const items = [
      ...reports.map((r: RawReport) => ({
        id: r.id,
        kind: "user_report" as const,
        contentType: r.targetType.toLowerCase(),
        contentId: r.targetId,
        userId: r.reporter?.id ?? "unknown",
        userEmail: r.reporter?.email ?? "",
        userName: r.reporter?.name ?? "Unknown",
        summary: `${r.reason.replace(/_/g, " ")}${r.details ? ` — ${r.details}` : ""}`,
        score: null as number | null,
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...flags.map((f: RawFlag) => ({
        id: f.id,
        kind: "ai_flag" as const,
        contentType: f.contentType,
        contentId: f.contentId,
        userId: f.userId,
        userEmail: "",
        userName: "",
        summary: f.text?.slice(0, 120) ?? "(no preview)",
        score: f.score,
        status: f.status,
        createdAt: f.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, data: { items, total: items.length } });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to load review queue" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────
// POST — execute a review action
// Body: { id, kind, action, contentType, contentId, userId, reason? }
// ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const adminEmail = await getAdminEmail(request);

  let body: {
    id: string;
    kind: "user_report" | "ai_flag";
    action: "dismiss" | "remove_content" | "warn_user" | "ban_user";
    contentType: string;
    contentId: string;
    userId: string;
    reason?: string;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { id, kind, action, contentType, contentId, userId, reason } = body;

  try {
    // ── 1. Execute the action ──────────────────────────────
    if (action === "remove_content") {
      await removeContent(contentType, contentId);
    } else if (action === "warn_user") {
      await warnUser(userId, 7);
    } else if (action === "ban_user") {
      await banUser(userId);
    }
    // dismiss: no content action needed

    // ── 2. Update the queue item status ───────────────────
    const newStatus = action === "dismiss" ? "DISMISSED" : "ACTIONED";
    const endpoint = kind === "user_report" ? "reports" : "flags";
    await fetch(`${USER_SVC}/api/moderation/${endpoint}/${id}`, {
      method: "PATCH",
      headers: internalHeaders(),
      body: JSON.stringify({
        status: newStatus,
        reviewedBy: adminEmail,
        ...(action !== "dismiss" ? { actionTaken: action } : {}),
      }),
    });

    // ── 3. Write audit log ────────────────────────────────
    writeAudit(adminEmail, action, kind, id, reason, { contentType, contentId, userId });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[review] Action failed:", err);
    return NextResponse.json({ success: false, message: "Action failed" }, { status: 500 });
  }
}

// ─── Action helpers ─────────────────────────────────────

async function removeContent(contentType: string, contentId: string): Promise<void> {
  switch (contentType) {
    case "forum_question":
      await dbPool.query(
        `UPDATE forum_questions SET "deletedAt" = NOW() WHERE id = $1`,
        [contentId]
      );
      break;
    case "forum_answer":
      await dbPool.query(
        `UPDATE forum_answers SET "deletedAt" = NOW() WHERE id = $1`,
        [contentId]
      );
      break;
    case "chat_message":
      // chat schema is a separate PostgreSQL schema on the same DB
      await dbPool.query(
        `UPDATE chat.messages SET status = 'DELETED', "deletedAt" = NOW() WHERE id = $1`,
        [contentId]
      );
      break;
    default:
      // USER reports have no content to remove — no-op
      break;
  }
}

async function warnUser(userId: string, days: number): Promise<void> {
  const uuid = crypto.randomUUID();
  await dbPool.query(
    `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
     VALUES ($1, $2, true, NOW() + ($3 || ' days')::interval)
     ON CONFLICT ("userId") DO UPDATE
       SET "isSuspended" = true, "suspendedUntil" = NOW() + ($3 || ' days')::interval`,
    [uuid, userId, String(days)]
  );
}

async function banUser(userId: string): Promise<void> {
  const uuid = crypto.randomUUID();
  await dbPool.query(
    `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
     VALUES ($1, $2, true, NULL)
     ON CONFLICT ("userId") DO UPDATE SET "isSuspended" = true, "suspendedUntil" = NULL`,
    [uuid, userId]
  );
  // Also soft-delete the user account
  await dbPool.query(
    `UPDATE users SET
       name = 'Banned User',
       email = 'banned_' || id || '@digiability.deleted',
       "phoneNo" = NULL,
       "deletedAt" = NOW()
     WHERE id = $1 AND "deletedAt" IS NULL`,
    [userId]
  );
}
