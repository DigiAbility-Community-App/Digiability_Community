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

/** Shape + business-rule check: every open day must have from < to. */
export function isValidWeeklySchedule(s: unknown): s is WeeklySchedule {
  if (!s || typeof s !== "object") return false;
  const schedule = s as Record<string, unknown>;
  for (const { key } of DAYS) {
    const day = schedule[key] as DaySchedule | undefined;
    if (!day || typeof day !== "object" || typeof day.open !== "boolean") return false;
    if (day.open) {
      if (!day.from || !day.to) return false;
      if (day.from >= day.to) return false;
    }
  }
  return true;
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
    const label = day.open ? `${formatTime(day.from)}–${formatTime(day.to)}` : "Closed";
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
