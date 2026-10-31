import { progressWidth } from "@/lib/ui";

const metrics = [
  ["Relevance", "relevance", 25],
  ["Hiring Intent", "hiringIntent", 20],
  ["Freshness", "freshness", 15],
  ["Remote Fit", "remoteFit", 10],
  ["Commercial Value", "commercialValue", 10],
  ["Company Activity", "companyActivity", 10],
  ["Seniority", "seniority", 5],
  ["Data Quality", "dataQuality", 5]
];

export default function ScoreBreakdown({ breakdown, score }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-end justify-between border-b border-slate-100 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Transparent score</p><h3 className="mt-1 text-sm font-bold text-slate-900">Why this opportunity ranks highly</h3></div><span className="text-2xl font-black text-slate-900">{score}<span className="text-xs font-semibold text-slate-400">/100</span></span></div>
      <div className="mt-4 space-y-3">
        {metrics.map(([label, key, max]) => {
          const value = breakdown[key];
          const percent = Math.round((value / max) * 100);
          return <div key={key}><div className="mb-1 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-600">{label}</span><span className="font-bold text-slate-800">{value}/{max}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-brand-600 ${progressWidth(percent)}`} /></div></div>;
        })}
      </div>
    </div>
  );
}
