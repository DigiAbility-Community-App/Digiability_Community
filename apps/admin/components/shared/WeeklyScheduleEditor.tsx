"use client";

import { DAYS, DayKey, DaySchedule, WeeklySchedule } from "@/lib/availabilitySchedule";

const CLOSED: DaySchedule = { open: false, from: "", to: "" };

export function WeeklyScheduleEditor({
  value,
  onChange,
}: {
  value: WeeklySchedule;
  onChange: (next: WeeklySchedule) => void;
}) {
  const setDay = (key: DayKey, patch: Partial<WeeklySchedule[DayKey]>) => {
    onChange({ ...value, [key]: { ...(value?.[key] ?? CLOSED), ...patch } });
  };

  return (
    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
      {DAYS.map(({ key, label }) => {
        // A legacy row can store a malformed schedule; render that day as
        // closed instead of crashing the editor on `day.open`.
        const stored = value?.[key];
        const day = stored && typeof stored.open === "boolean" ? stored : CLOSED;
        return (
          <div key={key} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
            <label className="flex items-center gap-2 w-28 shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={day.open}
                onChange={(e) => setDay(key, e.target.checked ? { open: true } : { open: false, from: "", to: "" })}
                className="w-4 h-4 rounded border-slate-300 text-[#7004DC] focus:ring-[#7004DC]"
              />
              <span className="text-sm font-semibold text-[#1A1C1C]">{label}</span>
            </label>

            {day.open ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={day.from}
                  onChange={(e) => setDay(key, { from: e.target.value })}
                  aria-label={`${label} opens at`}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-[#7004DC]"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="time"
                  value={day.to}
                  onChange={(e) => setDay(key, { to: e.target.value })}
                  aria-label={`${label} closes at`}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-[#7004DC]"
                />
              </div>
            ) : (
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
