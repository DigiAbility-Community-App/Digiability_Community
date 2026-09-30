// ─────────────────────────────────────────────────────────────
// Date formatting for admin-facing timestamps.
//
// These run inside Next.js API routes, i.e. on the server — so a bare
// toLocaleDateString() formats in the *server's* timezone, not the admin's.
// Locally that happens to be IST; in production the container runs UTC, so
// every timestamp rendered 5h30m early for an India-based admin and anything
// after 18:30 IST showed the previous day.
//
// DigiAbility's admin team operates in India, so timestamps are formatted in
// IST explicitly. That makes the output identical in dev and production
// instead of silently depending on where the server happens to run.
//
// Pair this with the UTC timestamp parser in lib/db.ts — that gives a correct
// instant, this renders it in a consistent zone.
// ─────────────────────────────────────────────────────────────

export const ADMIN_TIME_ZONE = "Asia/Kolkata";

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** "08 Sep 2026" — IST. */
export function formatDate(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: ADMIN_TIME_ZONE,
  });
}

/** "08/09/2026, 22:27" — IST. */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ADMIN_TIME_ZONE,
  });
}
