export function scoreTone(score) {
  if (score == null) return "border-slate-200 bg-slate-50 text-slate-400";
  if (score >= 88) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 80) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function intentTone(intent) {
  const value = String(intent || "").toLowerCase();
  if (value === "strong") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

/** Inline width for progress bars; Tailwind cannot build class names from runtime values. */
export function barStyle(value, max = 100) {
  const pct = max > 0 && value != null ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return { width: `${pct}%` };
}
