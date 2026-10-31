export default function MetricCard({ label, value, change, note, hint }) {
  const negative = typeof change === "string" && change.startsWith("-");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" title={hint}>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-2xl font-black tracking-tight text-slate-900">{value}</span>
        {change ? <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${negative ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>{change}</span> : null}
      </div>
      {note ? <p className="mt-2 text-[11px] text-slate-400">{note}</p> : null}
    </div>
  );
}
