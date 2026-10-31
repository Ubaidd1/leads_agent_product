"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, LayoutGrid, List, Save, Search, X } from "lucide-react";
import { leads } from "@/data/leads";
import LeadTable from "@/components/leads/LeadTable";
import ExportModal from "@/components/leads/ExportModal";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { IntentBadge, ScoreBadge, Tag } from "@/components/ui/Badge";
import { keys, readStorage, writeStorage } from "@/lib/storage";
import { useToast } from "@/components/providers/ToastProvider";

export default function LeadsPageClient() {
  const searchParams = useSearchParams();
  const { notify } = useToast();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [service, setService] = useState("all");
  const [technology, setTechnology] = useState("all");
  const [intent, setIntent] = useState("all");
  const [minScore, setMinScore] = useState(75);
  const [view, setView] = useState("table");
  const [exportOpen, setExportOpen] = useState(false);

  const filtered = useMemo(() => leads.filter((lead) => {
    const haystack = `${lead.companyName} ${lead.jobTitle} ${lead.technologies.join(" ")}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (service === "all" || lead.serviceType === service) && (technology === "all" || lead.technologies.includes(technology)) && (intent === "all" || lead.hiringIntent === intent) && lead.leadScore >= minScore;
  }).sort((a,b) => b.leadScore - a.leadScore), [query, service, technology, intent, minScore]);

  function saveLead(lead) {
    const saved = readStorage(keys.savedLeads, []);
    if (saved.some((item) => item.id === lead.id)) { writeStorage(keys.savedLeads, saved.filter((item) => item.id !== lead.id)); notify("Removed lead from saved list.", "info"); }
    else { writeStorage(keys.savedLeads, [...saved, lead]); notify(`Saved ${lead.companyName}.`); }
  }

  function clear() { setQuery(""); setService("all"); setTechnology("all"); setIntent("all"); setMinScore(75); }

  return (
    <>
      <PageHeader eyebrow="Qualified opportunities" title="Lead Discovery" description="Search fresh, unique, verified hiring opportunities ranked by transparent commercial value." actions={<><Button onClick={() => notify("Current filters saved as a demo search.")}><Save className="h-4 w-4" />Save search</Button><Button variant="primary" onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />Export ({filtered.length})</Button></>} />
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white" /></label>
          <select value={service} onChange={(e) => setService(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><option value="all">All service types</option><option>Software Development</option><option>AI / ML</option><option>Web Development</option><option>SEO</option></select>
          <select value={technology} onChange={(e) => setTechnology(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><option value="all">All technologies</option>{["React","Node.js","Python","LLM","RAG","AWS","Next.js","SEO"].map((item) => <option key={item}>{item}</option>)}</select>
          <select value={intent} onChange={(e) => setIntent(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><option value="all">All hiring intent</option><option>Strong</option><option>Medium</option></select>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600"><span className="whitespace-nowrap">Score {minScore}+</span><input type="range" min="70" max="92" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full accent-brand-600" /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><div className="flex flex-wrap gap-2">{technology !== "all" ? <button onClick={() => setTechnology("all")} className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700">{technology}<X className="h-3 w-3" /></button> : null}{intent !== "all" ? <button onClick={() => setIntent("all")} className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{intent}<X className="h-3 w-3" /></button> : null}<button onClick={clear} className="text-[11px] font-semibold text-slate-400 hover:text-rose-600">Clear filters</button></div><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1"><button onClick={() => setView("table")} className={`rounded-md p-1.5 ${view === "table" ? "bg-white text-brand-600 shadow-sm" : "text-slate-400"}`}><List className="h-4 w-4" /></button><button onClick={() => setView("card")} className={`rounded-md p-1.5 ${view === "card" ? "bg-white text-brand-600 shadow-sm" : "text-slate-400"}`}><LayoutGrid className="h-4 w-4" /></button></div></div>
      </div>
      {filtered.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"><h3 className="text-sm font-bold text-slate-900">No leads match these filters</h3><p className="mt-2 text-xs text-slate-500">Try reducing the minimum score or clearing a technology filter.</p><Button className="mt-4" onClick={clear}>Clear filters</Button></div> : view === "table" ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><LeadTable leads={filtered} onSave={saveLead} /><div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500"><span>{filtered.length} qualified results</span><span className="font-semibold">Page 1 of 1 · 25/page</span></div></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((lead) => <a key={lead.id} href={`/leads/${lead.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-soft"><div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-[11px] font-black">{lead.companyLogo}</span><ScoreBadge score={lead.leadScore} /></div><h3 className="mt-4 text-sm font-bold text-slate-900">{lead.jobTitle}</h3><p className="mt-1 text-xs text-slate-500">{lead.companyName}</p><div className="mt-3 flex flex-wrap gap-1">{lead.technologies.map((item) => <Tag key={item}>{item}</Tag>)}</div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><IntentBadge intent={lead.hiringIntent} /><span className="text-xs font-bold text-emerald-700">{lead.salaryRange}</span></div></a>)}</div>}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} leads={filtered} />
    </>
  );
}