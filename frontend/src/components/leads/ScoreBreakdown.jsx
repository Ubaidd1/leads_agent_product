import { barStyle } from "@/lib/ui";
import { formatDateTime } from "@/lib/format";

const LABELS = {
  relevance: "Relevance",
  hiringIntent: "Hiring Intent",
  freshness: "Freshness",
  remoteFit: "Remote Fit",
  commercialValue: "Commercial Value",
  companyActivity: "Company Activity",
  seniority: "Seniority",
  dataQuality: "Data Quality"
};

/** `score` is the API's ScoreOut: { total, version, components, max, rationale, calculatedAt } or null. */
export default function ScoreBreakdown({ score }) {
  const illustrative = score?.version === "demo-fixture";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-end justify-between border-b border-slate-100 pb-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Transparent score</p><h3 className="mt-1 text-sm font-bold text-slate-900">How this score is built</h3></div>
        <span className="text-2xl font-black text-slate-900">{score ? score.total : "—"}<span className="text-xs font-semibold text-slate-400">/100</span></span>
      </div>
      {!score ? (
        <p className="mt-4 text-xs leading-5 text-slate-500">This lead has not been scored yet. Scores appear once the scoring engine has processed it.</p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {Object.entries(score.max).map(([key, max]) => {
              const value = score.components[key];
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-600">{LABELS[key] || key}</span><span className="font-bold text-slate-800">{value ?? "—"}/{max}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={barStyle(value ?? 0, max)} /></div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
            <p>Version <span className="font-semibold text-slate-600">{score.version}</span> · calculated {formatDateTime(score.calculatedAt)}</p>
            {illustrative ? <p className="font-semibold text-amber-700">Illustrative demo values, not produced by the scoring engine.</p> : null}
          </div>
        </>
      )}
    </div>
  );
}
