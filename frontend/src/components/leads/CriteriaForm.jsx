"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { savedSearchesApi } from "@/lib/api/saved-searches";
import { isAbortError } from "@/lib/api/client";
import { criteriaToQuery } from "@/lib/criteria";
import { FRESHNESS, INTENTS, REGIONS, SERVICE_TYPES, TECHNOLOGIES } from "@/lib/constants";

const selectClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold";

function ToggleList({ options, values, onChange, label }) {
  const toggle = (value) => onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  return (
    <fieldset>
      <legend className="text-xs font-bold text-slate-700">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([value, text]) => {
          const active = values.includes(value);
          return <button type="button" key={value} onClick={() => toggle(value)} aria-pressed={active} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold ${active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{active ? <Check className="h-3 w-3" /> : null}{text}</button>;
        })}
      </div>
    </fieldset>
  );
}

/** Live count of open leads matching `criteria` (debounced GET /leads/count). */
export function useMatchCount(criteria) {
  const [state, setState] = useState({ total: null, loading: true, error: null });
  const key = JSON.stringify(criteria);
  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const { total } = await savedSearchesApi.count(criteriaToQuery(criteria), { signal: controller.signal });
        setState({ total, loading: false, error: null });
      } catch (error) {
        if (!isAbortError(error)) setState({ total: null, loading: false, error });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

export function MatchEstimate({ criteria }) {
  const { total, loading, error } = useMatchCount(criteria);
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4" aria-live="polite">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-600">Matching leads right now</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">{error ? "—" : total == null ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : `${total.toLocaleString()} ${total === 1 ? "lead" : "leads"}`}{loading && total != null ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}</p>
      <p className="mt-1 text-xs text-slate-500">{error ? error.message : "Open leads visible to your workspace that match these criteria."}</p>
    </div>
  );
}

export default function CriteriaForm({ criteria, onChange }) {
  const set = (changes) => onChange({ ...criteria, ...changes });
  return (
    <div className="space-y-5">
      <label className="block text-xs font-bold text-slate-700">Keywords<input value={criteria.q} onChange={(e) => set({ q: e.target.value })} maxLength={200} placeholder="Optional: words in the title, company or technologies" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
      <ToggleList label="What are you selling? (service types)" options={SERVICE_TYPES.map((s) => [s, s])} values={criteria.serviceTypes} onChange={(serviceTypes) => set({ serviceTypes })} />
      <div>
        <ToggleList label="Technologies" options={TECHNOLOGIES.map((t) => [t, t])} values={criteria.technologies} onChange={(technologies) => set({ technologies })} />
        {criteria.technologies.length > 1 ? <div className="mt-2 flex gap-4 text-xs text-slate-600"><label className="flex items-center gap-1.5"><input type="radio" checked={criteria.technologyMatch !== "all"} onChange={() => set({ technologyMatch: "any" })} className="accent-brand-600" />Any of these</label><label className="flex items-center gap-1.5"><input type="radio" checked={criteria.technologyMatch === "all"} onChange={() => set({ technologyMatch: "all" })} className="accent-brand-600" />All of these</label></div> : null}
      </div>
      <ToggleList label="Target geography" options={REGIONS} values={criteria.regions} onChange={(regions) => set({ regions })} />
      <div className="grid gap-5 md:grid-cols-2">
        <ToggleList label="Hiring intent" options={INTENTS} values={criteria.intents} onChange={(intents) => set({ intents })} />
        <label className="text-xs font-bold text-slate-700">Freshness<select value={criteria.freshnessDays ?? ""} onChange={(e) => set({ freshnessDays: e.target.value ? Number(e.target.value) : null })} className={selectClass}><option value="">Any posting date</option>{FRESHNESS.map(([value, label]) => <option key={value} value={value}>Posted in the last {label}</option>)}</select></label>
      </div>
      <label className="block text-xs font-bold text-slate-700">Minimum lead score: {criteria.minScore == null ? "any" : `${criteria.minScore}/100`}<input type="range" min="0" max="95" step="5" value={criteria.minScore ?? 0} onChange={(e) => set({ minScore: Number(e.target.value) || null })} className="mt-3 w-full accent-brand-600" /></label>
    </div>
  );
}
