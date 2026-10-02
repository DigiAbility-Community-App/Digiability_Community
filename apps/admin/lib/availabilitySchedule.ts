// ─────────────────────────────────────────────────────────────
// Weekly open/closed schedule for a Service listing. `availabilitySchedule`
// (JSONB) is the source of truth an admin edits; `availability` (TEXT) is a
// server-derived human-readable summary kept for backward compatibility —
// every consumer (admin table, CSV export, mobile card) just renders that
// string and never needs to know a schedule exists.
// ─────────────────────────────────────────────────────────────

export type DayKey =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export interface DaySchedule {
  open: boolean;
  /** "HH:MM" 24h, only meaningful when open */
  from: string;
  to: string;
}

export type WeeklySchedule = Record<DayKey, DaySchedule>;

export const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

export function defaultWeeklySchedule(): WeeklySchedule {
  const schedule = {} as WeeklySchedule;
  for (const { key } of DAYS) {
    schedule[key] = { open: false, from: "", to: "" };
  }
  return schedule;
}

export type ScheduleValidation =
  | { ok: true }
  | { ok: false; day: string | null; reason: "shape" | "missing" | "order" };

/** "00:00" as a closing time means midnight at the end of the day. */
export const MIDNIGHT = "00:00";

/**
 * Shape + business-rule check with the reason, so the form can say which day
 * is wrong and why. Every open day needs from and to, and from < to, except
 * that a close of "00:00" means "until midnight" (end of the same day).
 *
 * Times are "HH:MM" from <input type="time">, which is always zero-padded
 * 24h, so string comparison is chronological.
 */
export function validateWeeklySchedule(s: unknown): ScheduleValidation {
  if (!s || typeof s !== "object") return { ok: false, day: null, reason: "shape" };
  const schedule = s as Record<string, unknown>;
  for (const { key, label } of DAYS) {
    const day = schedule[key] as DaySchedule | undefined;
    if (!day || typeof day !== "object" || typeof day.open !== "boolean") {
      return { ok: false, day: label, reason: "shape" };
    }
    if (day.open) {
      if (!day.from || !day.to) return { ok: false, day: label, reason: "missing" };
      const closesAtMidnight = day.to === MIDNIGHT && day.from !== MIDNIGHT;
      if (!closesAtMidnight && day.from >= day.to) return { ok: false, day: label, reason: "order" };
    }
  }
  return { ok: true };
}

/** User-facing message for a failed validateWeeklySchedule(). */
export function scheduleErrorMessage(v: Exclude<ScheduleValidation, { ok: true }>): string {
  if (v.reason === "missing") return `${v.day}: set both a From and a To time.`;
  if (v.reason === "order") {
    return `${v.day}: the From time must be earlier than the To time (use 12:00 AM as the To time for "until midnight").`;
  }
  return v.day ? `${v.day}: the schedule for this day is invalid.` : "Invalid availability schedule.";
}

export function isValidWeeklySchedule(s: unknown): s is WeeklySchedule {
  return validateWeeklySchedule(s).ok;
}

function formatTime(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  const h = parseInt(m[1], 10);
  const min = m[2];
  return `${h % 12 || 12}:${min} ${h >= 12 ? "PM" : "AM"}`;
}

function dayKey(day: DaySchedule): string {
  return day.open ? `open:${day.from}-${day.to}` : "closed";
}

/**
 * Groups consecutive days (Monday→Sunday) with identical open/closed+hours
 * into ranges, e.g. "Mon–Fri: 9:00 AM–6:00 PM · Sat–Sun: Closed".
 * Returns "Closed all week" when no day is open.
 */
export function formatAvailabilitySummary(schedule: WeeklySchedule): string {
  if (!isValidWeeklySchedule(schedule)) return "Closed all week";

  const groups: { label: string; sig: string; days: string[] }[] = [];
  for (const { key, short } of DAYS) {
    const day = schedule[key];
    const sig = dayKey(day);
    const closes = day.to === MIDNIGHT ? "Midnight" : formatTime(day.to);
    const label = day.open ? `${formatTime(day.from)}–${closes}` : "Closed";
    const last = groups[groups.length - 1];
    if (last && last.sig === sig) {
      last.days.push(short);
    } else {
      groups.push({ label, sig, days: [short] });
    }
  }

  if (groups.length === 1 && groups[0].label === "Closed") return "Closed all week";

  return groups
    .map(g => {
      const range = g.days.length > 1 ? `${g.days[0]}–${g.days[g.days.length - 1]}` : g.days[0];
      return `${range}: ${g.label}`;
    })
    .join(" · ");
}
