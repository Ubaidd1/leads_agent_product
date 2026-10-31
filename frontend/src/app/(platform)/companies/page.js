"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import { IntentBadge, Tag } from "@/components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import { companiesApi } from "@/lib/api/catalog";
import { toQuery } from "@/lib/api/client";
import { useApi } from "@/lib/useApi";
import { COMPANY_SORTS, INTENTS } from "@/lib/constants";

const selectClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600";
const dash = (value, suffix = "") => (value == null ? <span className="text-slate-300">—</span> : `${value}${suffix}`);

function CompaniesView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") || "";
  const intent = params.get("intent") || "";
  const sort = params.get("sort") || "intentScore";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Number(params.get("pageSize")) || 25;
  const [text, setText] = useState(q);

  function update(changes, resetPage = true) {
    const next = { q, intent, sort, pageSize, ...changes };
    router.replace(`${pathname}${toQuery({
      q: next.q || undefined,
      intent: next.intent || undefined,
      sort: next.sort !== "intentScore" ? next.sort : undefined,
      page: !resetPage && next.page > 1 ? next.page : undefined,
      pageSize: next.pageSize !== 25 ? next.pageSize : undefined
    })}`, { scroll: false });
  }

  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (text === q) return undefined;
    const timer = setTimeout(() => update({ q: text }), 300);
    return () => clearTimeout(timer);
  }, [text, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const companies = useApi((signal) => companiesApi.list({ q: q || undefined, intent: intent || undefined, sort, page, pageSize }, { signal }), [params.toString()], { keepPrevious: true });
  const data = companies.data;

  return (
    <>
      <PageHeader eyebrow="Company-level intelligence" title="Companies" description="Prioritize organizations showing sustained, accelerating or concentrated hiring demand." />
      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative block min-w-[240px] flex-1 md:max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search company, industry or technology..." aria-label="Search companies" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-brand-500" /></label>
        <select aria-label="Hiring intent" value={intent} onChange={(e) => update({ intent: e.target.value })} className={selectClass}><option value="">All hiring intent</option>{INTENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Sort by" value={sort} onChange={(e) => update({ sort: e.target.value })} className={selectClass}>{COMPANY_SORTS.map(([value, label]) => <option key={value} value={value}>Sort: {label}</option>)}</select>
      </div>
      {companies.error ? <ErrorState error={companies.error} onRetry={companies.reload} title="Could not load companies" />
        : !data ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SkeletonRows rows={8} /></div>
        : data.items.length === 0 ? <EmptyState title={q || intent ? "No companies match" : "No companies yet"} description={q || intent ? "Try a different search or clear the intent filter." : "Companies appear once leads have been ingested from an approved source."} />
        : (
          <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${companies.loading ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500"><th className="px-4 py-3">Company</th><th className="px-4 py-3">Intent score</th><th className="px-4 py-3">Open roles</th><th className="px-4 py-3">Relevant</th><th className="px-4 py-3">Velocity</th><th className="px-4 py-3" title="Open leads visible in your workspace">Tracked leads</th><th className="px-4 py-3">Technologies</th><th className="px-4 py-3">Departments</th></tr></thead><tbody className="divide-y divide-slate-100">{data.items.map((company) => <tr key={company.id} className="hover:bg-slate-50"><td className="px-4 py-3"><Link href={`/companies/${company.slug}`} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-[11px] font-black">{company.logo}</span><span><span className="block text-xs font-bold text-slate-900">{company.name}</span><span className="mt-1 block text-[10px] text-slate-400">{company.industry || "Industry unknown"}</span></span></Link></td><td className="px-4 py-3">{company.intentScore != null ? <><span className="text-sm font-black text-slate-900">{company.intentScore}</span><span className="text-[10px] text-slate-400">/100</span></> : <span className="text-xs text-slate-300">—</span>}<div className="mt-1"><IntentBadge intent={company.intent} /></div></td><td className="px-4 py-3 text-xs font-bold">{dash(company.openRoles)}</td><td className="px-4 py-3 text-xs font-bold text-brand-600">{dash(company.relevantRoles)}</td><td className="px-4 py-3 text-xs font-bold text-emerald-700">{company.hiringVelocityPct != null ? `${company.hiringVelocityPct > 0 ? "+" : ""}${company.hiringVelocityPct}%` : dash(null)}</td><td className="px-4 py-3 text-xs font-bold">{company.trackedLeads}</td><td className="px-4 py-3"><div className="flex max-w-[220px] flex-wrap gap-1">{company.technologies.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}</div></td><td className="px-4 py-3 text-[11px] text-slate-600">{company.departments.join(", ") || "—"}</td></tr>)}</tbody></table></div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages} onPage={(p) => update({ page: p }, false)} onPageSize={(size) => update({ pageSize: size })} noun="companies" />
          </div>
        )}
    </>
  );
}

export default function CompaniesPage() {
  return <Suspense fallback={null}><CompaniesView /></Suspense>;
}
