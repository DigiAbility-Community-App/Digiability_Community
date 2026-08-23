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

export const MONTH_ABBREVS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
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

/**
 * Parses any date format (YYYY-MM-DD, DD/MM/YYYY, "24 AUG", "15 September 2026")
 * into clean day and month abbreviation for UI badges.
 */
export function parseEventBadgeParts(dateStr: string): { day: string; month: string; displayDate: string } {
  if (!dateStr) return { day: "--", month: "EVENT", displayDate: "" };
  const str = dateStr.trim();

  // YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const yr = iso[1];
    const mNum = parseInt(iso[2], 10);
    const dNum = parseInt(iso[3], 10);
    const month = MONTH_ABBREVS[mNum - 1] || "EVENT";
    const day = String(dNum);
    return {
      day,
      month,
      displayDate: `${String(dNum).padStart(2, "0")}/${String(mNum).padStart(2, "0")}/${yr}`,
    };
  }

  // DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const dNum = parseInt(dmy[1], 10);
    const mNum = parseInt(dmy[2], 10);
    const yr = dmy[3];
    const month = MONTH_ABBREVS[mNum - 1] || "EVENT";
    const day = String(dNum);
    return {
      day,
      month,
      displayDate: `${String(dNum).padStart(2, "0")}/${String(mNum).padStart(2, "0")}/${yr}`,
    };
  }

  // "30 AUG" or "24 AUG 2026" or "15 March 2026"
  const parts = str.split(/\s+/);
  if (parts.length >= 2) {
    const dayNum = parseInt(parts[0], 10);
    const monthIdx = MONTH_ABBREVS.findIndex((m) => m.toLowerCase() === parts[1].toLowerCase().slice(0, 3));
    if (!isNaN(dayNum) && monthIdx !== -1) {
      const yr = parts[2] || String(new Date().getFullYear());
      return {
        day: String(dayNum),
        month: MONTH_ABBREVS[monthIdx],
        displayDate: `${String(dayNum).padStart(2, "0")}/${String(monthIdx + 1).padStart(2, "0")}/${yr}`,
      };
    }
  }

  return { day: str.slice(0, 5), month: "EVENT", displayDate: str };
}

/**
 * Consistently format any date string into standard Indian DD/MM/YYYY format.
 */
export function formatEventDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  return parseEventBadgeParts(dateStr).displayDate;
}
