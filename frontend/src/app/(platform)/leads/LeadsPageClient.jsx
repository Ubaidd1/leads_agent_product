"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, LayoutGrid, List, Save, Search, X } from "lucide-react";
import LeadTable, { SaveButton } from "@/components/leads/LeadTable";
import ExportModal from "@/components/leads/ExportModal";
import SaveSearchModal from "@/components/leads/SaveSearchModal";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import { IntentBadge, ScoreBadge, Tag } from "@/components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import { leadsApi } from "@/lib/api/catalog";
import { toQuery } from "@/lib/api/client";
import { useApi } from "@/lib/useApi";
import { useLeadSave } from "@/lib/useLeadSave";
import { criteriaFromParams, criteriaToQuery, hasFilters } from "@/lib/criteria";
import { FRESHNESS, INTENTS, LEAD_SORTS, REGIONS, SERVICE_TYPES, TECHNOLOGIES, regionLabel } from "@/lib/constants";
import { formatSalary, titleCase } from "@/lib/format";
import { keys, readStorage, writeStorage } from "@/lib/storage";

const selectClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600";

function Chip({ tone = "brand", onClear, children }) {
  const tones = { brand: "border-brand-100 bg-brand-50 text-brand-700", emerald: "border-emerald-100 bg-emerald-50 text-emerald-700" };
  return <button onClick={onClear} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${tones[tone]}`}>{children}<X className="h-3 w-3" /></button>;
}

export default function LeadsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const criteria = useMemo(() => criteriaFromParams(searchParams), [searchParams]);
  const sort = searchParams.get("sort") || "score";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Number(searchParams.get("pageSize")) || 25;

  const [text, setText] = useState(criteria.q);
  const [view, setView] = useState("table");
  const [exportOpen, setExportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => setView(readStorage(keys.leadsView, "table")), []);
  useEffect(() => setText(criteria.q), [criteria.q]);

  /** Replaces the URL so every view is shareable and survives a refresh. Filter changes reset to page 1. */
  const update = useCallback((changes, { resetPage = true } = {}) => {
    const next = { ...criteria, ...changes.criteria };
    const query = {
      ...criteriaToQuery(next),
      sort: (changes.sort ?? sort) !== "score" ? changes.sort ?? sort : undefined,
      order: (changes.order ?? order) !== "desc" ? changes.order ?? order : undefined,
      page: resetPage ? undefined : changes.page > 1 ? changes.page : undefined,
      pageSize: (changes.pageSize ?? pageSize) !== 25 ? changes.pageSize ?? pageSize : undefined
    };
    router.replace(`${pathname}${toQuery(query)}`, { scroll: false });
  }, [criteria, sort, order, pageSize, pathname, router]);

  // Debounce free-text search by 300 ms.
  useEffect(() => {
    if (text === criteria.q) return undefined;
    const timer = setTimeout(() => update({ criteria: { q: text } }), 300);
    return () => clearTimeout(timer);
  }, [text, criteria.q, update]);

  const queryKey = searchParams.toString();
  const leads = useApi(
    (signal) => leadsApi.list({ ...criteriaToQuery(criteria), sort, order, page, pageSize }, { signal }),
    [queryKey],
    { keepPrevious: true }
  );

  const applySaved = useCallback((id, isSaved) => {
    leads.setData((data) => data && { ...data, items: data.items.map((lead) => (lead.id === id ? { ...lead, isSaved } : lead)) });
  }, [leads.setData]); // eslint-disable-line react-hooks/exhaustive-deps
  const { toggle, pending } = useLeadSave(applySaved);

  const single = (value) => (value === "all" ? [] : [value]);
  const clear = () => { setText(""); router.replace(pathname, { scroll: false }); };
  const data = leads.data;
  const total = data?.total ?? null;

  return (
    <>
      <PageHeader eyebrow="Qualified opportunities" title="Lead Discovery" description="Search fresh, unique, verified hiring opportunities ranked by transparent commercial value." actions={<><Button onClick={() => setSaveOpen(true)}><Save className="h-4 w-4" />Save search</Button><Button variant="primary" disabled={!total} onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />Export{total != null ? ` (${total.toLocaleString()})` : ""}</Button></>} />
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <label className="relative sm:col-span-2 xl:col-span-1 2xl:col-span-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search title, company or technology..." aria-label="Search leads" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white" /></label>
          <select aria-label="Service type" value={criteria.serviceTypes[0] || "all"} onChange={(e) => update({ criteria: { serviceTypes: single(e.target.value) } })} className={selectClass}><option value="all">All service types</option>{SERVICE_TYPES.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Technology" value={criteria.technologies.length === 1 ? criteria.technologies[0] : "all"} onChange={(e) => update({ criteria: { technologies: single(e.target.value) } })} className={selectClass}><option value="all">{criteria.technologies.length > 1 ? `${criteria.technologies.length} technologies` : "All technologies"}</option>{TECHNOLOGIES.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Hiring intent" value={criteria.intents[0] || "all"} onChange={(e) => update({ criteria: { intents: single(e.target.value) } })} className={selectClass}><option value="all">All hiring intent</option>{INTENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Geography" value={criteria.regions[0] || "all"} onChange={(e) => update({ criteria: { regions: single(e.target.value) } })} className={selectClass}><option value="all">Any geography</option>{REGIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Freshness" value={criteria.freshnessDays ?? "all"} onChange={(e) => update({ criteria: { freshnessDays: e.target.value === "all" ? null : Number(e.target.value) } })} className={selectClass}><option value="all">Any posting date</option>{FRESHNESS.map(([value, label]) => <option key={value} value={value}>Posted in {label}</option>)}</select>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 xl:col-span-2"><span className="whitespace-nowrap">{criteria.minScore != null ? `Score ${criteria.minScore}+` : "Any score"}</span><input type="range" min="0" max="95" step="5" value={criteria.minScore ?? 0} onChange={(e) => update({ criteria: { minScore: Number(e.target.value) || null } })} aria-label="Minimum lead score" className="w-full accent-brand-600" /></label>
          <select aria-label="Sort by" value={sort} onChange={(e) => update({ sort: e.target.value })} className={selectClass}>{LEAD_SORTS.map(([value, label]) => <option key={value} value={value}>Sort: {label}</option>)}</select>
          <select aria-label="Sort order" value={order} onChange={(e) => update({ order: e.target.value })} className={selectClass}><option value="desc">Descending</option><option value="asc">Ascending</option></select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-2">
            {criteria.serviceTypes.map((item) => <Chip key={item} onClear={() => update({ criteria: { serviceTypes: criteria.serviceTypes.filter((v) => v !== item) } })}>{item}</Chip>)}
            {criteria.technologies.map((item) => <Chip key={item} onClear={() => update({ criteria: { technologies: criteria.technologies.filter((v) => v !== item) } })}>{item}</Chip>)}
            {criteria.intents.map((item) => <Chip key={item} tone="emerald" onClear={() => update({ criteria: { intents: criteria.intents.filter((v) => v !== item) } })}>{titleCase(item)} intent</Chip>)}
            {criteria.regions.map((item) => <Chip key={item} onClear={() => update({ criteria: { regions: criteria.regions.filter((v) => v !== item) } })}>{regionLabel(item)}</Chip>)}
            {hasFilters(criteria) ? <button onClick={clear} className="text-[11px] font-semibold text-slate-400 hover:text-rose-600">Clear filters</button> : <span className="text-[11px] text-slate-400">Showing all open leads</span>}
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">{[["table", List], ["card", LayoutGrid]].map(([mode, Icon]) => <button key={mode} onClick={() => { setView(mode); writeStorage(keys.leadsView, mode); }} aria-label={`${mode} view`} aria-pressed={view === mode} className={`rounded-md p-1.5 ${view === mode ? "bg-white text-brand-600 shadow-sm" : "text-slate-400"}`}><Icon className="h-4 w-4" /></button>)}</div>
        </div>
      </div>

      {leads.error ? <ErrorState error={leads.error} onRetry={leads.reload} title="Could not load leads" />
        : !data ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SkeletonRows rows={8} /></div>
        : data.items.length === 0 ? <EmptyState title="No leads match these filters" description={hasFilters(criteria) ? "Try lowering the minimum score, widening the posting date, or clearing a filter." : "No open leads are available to this workspace yet. Leads appear once an approved data source has been synced or a CSV has been imported."} action={hasFilters(criteria) ? <Button onClick={clear}>Clear filters</Button> : <Link href="/settings/data-sources"><Button>View data sources</Button></Link>} />
        : (
          <div className={leads.loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={leads.loading}>
            {view === "table" ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><LeadTable leads={data.items} onSave={toggle} pendingIds={pending} /><Pagination page={data.page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages} onPage={(p) => update({ page: p }, { resetPage: false })} onPageSize={(size) => update({ pageSize: size })} noun="leads" /></div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.items.map((lead) => <Link key={lead.id} href={`/leads/${lead.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-soft"><div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-[11px] font-black">{lead.companyLogo}</span><div className="flex items-center gap-2"><ScoreBadge score={lead.leadScore} /><SaveButton lead={lead} pending={pending.has(lead.id)} onSave={toggle} /></div></div><h3 className="mt-4 text-sm font-bold text-slate-900">{lead.jobTitle}</h3><p className="mt-1 text-xs text-slate-500">{lead.companyName}</p><div className="mt-3 flex flex-wrap gap-1">{lead.technologies.map((item) => <Tag key={item}>{item}</Tag>)}</div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><IntentBadge intent={lead.hiringIntent} /><span className="text-xs font-bold text-emerald-700">{formatSalary(lead.salaryMin, lead.salaryMax, lead.salaryCurrency)}</span></div></Link>)}</div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages} onPage={(p) => update({ page: p }, { resetPage: false })} onPageSize={(size) => update({ pageSize: size })} noun="leads" /></div>
              </>
            )}
          </div>
        )}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} criteria={criteria} count={total} />
      <SaveSearchModal open={saveOpen} onClose={() => setSaveOpen(false)} criteria={criteria} onSaved={(created) => router.push(`/saved-searches/${created.id}`)} />
    </>
  );
}
