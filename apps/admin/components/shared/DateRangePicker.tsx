"use client";

import { Calendar, X } from "lucide-react";

/**
 * Inclusive date-range check against a raw ISO timestamp. `from`/`to` are
 * "YYYY-MM-DD" values from a native date input (or "" when unset). `to` is
 * treated as end-of-day so the selected end date itself is included.
 */
export function isWithinDateRange(
  iso: string | null | undefined,
  from: string,
  to: string
): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return false;
  if (from) {
    const start = new Date(from + "T00:00:00").getTime();
    if (d < start) return false;
  }
  if (to) {
    const end = new Date(to + "T23:59:59.999").getTime();
    if (d > end) return false;
  }
  return true;
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className = "h-9 rounded-lg border border-gray-200 text-xs font-semibold text-[#4B4355] bg-white outline-none focus:border-[#7004DC]",
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  /** Input styling — pass a page's own filter-input classes to match its siblings. */
  className?: string;
}) {
  const hasRange = Boolean(from || to);

  return (
    <div className="flex items-center gap-1.5">
      <Calendar className="w-4 h-4 text-[#7D7387] shrink-0" />
      <input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        max={to || undefined}
        aria-label="From date"
        className={`${className} px-2.5`}
      />
      <span className="text-xs text-[#9A93A8]">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        min={from || undefined}
        aria-label="To date"
        className={`${className} px-2.5`}
      />
      {hasRange && (
        <button
          type="button"
          onClick={() => {
            onFromChange("");
            onToChange("");
          }}
          aria-label="Clear date range"
          className="text-[#7D7387] hover:text-[#1A1C1C] transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
