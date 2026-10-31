"use client";

export const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"]];

/** Converts "last N days" to the API's from/to (dates; the server applies the workspace timezone). */
export function rangeQuery(days) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
}

export default function RangeSelect({ value, onChange }) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Date range">
      {RANGES.map(([days, label]) => (
        <button key={days} onClick={() => onChange(days)} aria-pressed={value === days} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${value === days ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{label}</button>
      ))}
    </div>
  );
}
