// ─────────────────────────────────────────────────────────────
// IST (Indian Standard Time) date helpers for chat date separators.
//
// All date comparisons use IST (UTC+5:30) so that "Today" and
// "Yesterday" labels are correct for Indian users regardless of
// the device's local timezone.
// ─────────────────────────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +5:30 in ms

/** Shift a Date so its UTC accessors return IST calendar values. */
function toIST(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** Return a "YYYY-MM-DD" key representing the IST calendar date. */
export function istDateKey(date: Date): string {
  const ist = toIST(date);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Return a human-readable label for a date key:
 *  - "Today"
 *  - "Yesterday"
 *  - "14 August 2026"  (Indian convention: day month year)
 */
export function formatDateLabel(dateKey: string): string {
  const todayKey = istDateKey(new Date());
  if (dateKey === todayKey) return "Today";

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayKey = istDateKey(yesterday);
  if (dateKey === yesterdayKey) return "Yesterday";

  const [y, m, d] = dateKey.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}
