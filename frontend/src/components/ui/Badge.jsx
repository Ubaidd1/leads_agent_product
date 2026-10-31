import { intentTone, scoreTone } from "@/lib/ui";
import { titleCase } from "@/lib/format";

export function IntentBadge({ intent }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${intentTone(intent)}`}>{intent ? titleCase(intent) : "Unknown"}</span>;
}

export function ScoreBadge({ score }) {
  return <span title={score == null ? "Not scored yet" : undefined} className={`inline-flex min-w-14 items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-black ${scoreTone(score)}`}>{score == null ? "—" : `${score}/100`}</span>;
}

export function Tag({ children }) {
  return <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">{children}</span>;
}

export function StatusPill({ tone = "slate", children }) {
  const tones = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    brand: "border-brand-100 bg-brand-50 text-brand-700",
    slate: "border-slate-200 bg-slate-50 text-slate-500"
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold ${tones[tone]}`}>{children}</span>;
}
