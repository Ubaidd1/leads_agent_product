"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { getLead, leads } from "@/data/leads";
import { getCompany } from "@/data/companies";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { IntentBadge, ScoreBadge, Tag } from "@/components/ui/Badge";
import ScoreBreakdown from "@/components/leads/ScoreBreakdown";
import ExportModal from "@/components/leads/ExportModal";
import { useToast } from "@/components/providers/ToastProvider";

export default function LeadDetailPage() {
  const { id } = useParams();
  const { notify } = useToast();
  const [exportOpen, setExportOpen] = useState(false);
  const lead = getLead(id) || leads[0];
  const company = getCompany(lead.companyId);

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500"><Link href="/leads" className="inline-flex items-center gap-1 font-semibold hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />Lead Discovery</Link><span>/</span><Link href={`/companies/${company.id}`} className="hover:text-slate-800">{company.name}</Link><span>/</span><span className="truncate font-semibold text-slate-700">{lead.jobTitle}</span></div>
      <Card className="p-5 md:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-sm font-black text-brand-700">{lead.companyLogo}</span><div><div className="mb-2 flex flex-wrap gap-2"><IntentBadge intent={lead.hiringIntent} /><span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">{lead.remoteFit}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">Verified {lead.lastVerified}</span></div><h1 className="text-xl font-black text-slate-900 md:text-2xl">{lead.jobTitle}</h1><p className="mt-1 text-sm text-slate-500">{lead.companyName} · {company.industry} · {company.location} · {company.size}</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><ScoreBadge score={lead.leadScore} /><Button onClick={() => notify("Lead saved to your workspace.")}><Bookmark className="h-4 w-4" />Save lead</Button><Button onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />Export</Button><a href={lead.canonicalUrl} target="_blank" rel="noreferrer"><Button variant="primary">Visit job<ExternalLink className="h-4 w-4" /></Button></a></div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_0.85fr]">
        <div className="space-y-5">
          <Card><CardHeader title="Why this lead matters" description="Commercial rationale generated from transparent hiring signals." /><div className="p-5"><div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm leading-6 text-slate-700">{lead.rationale}</div></div></Card>
          <Card><CardHeader title="Hiring Signals" description="Company-level indicators that strengthen buying-intent confidence." /><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">{[["Open Roles",company.openRoles],["Relevant Roles",lead.relevantOpenRoles],["Hiring Velocity",`+${company.hiringVelocity}%`],["Skill Concentration",company.skillConcentration],["Departments",company.departments.join(" + ")],["Repeated Hiring","Detected"]].map(([label,value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p><p className="mt-2 text-sm font-black leading-5 text-slate-800">{value}</p></div>)}</div></Card>
          <Card><CardHeader title="Hiring Activity Timeline" description="Recent events associated with this opportunity." /><div className="p-5">{lead.timeline.map((item,index) => <div key={`${item.date}-${item.event}`} className="grid grid-cols-[90px_18px_1fr] gap-3 pb-5 last:pb-0"><span className="text-[11px] font-semibold text-slate-400">{item.date}</span><div className="relative"><span className="absolute left-[7px] top-1 h-full w-px bg-slate-200 last:hidden" /><span className="relative z-10 block h-3 w-3 rounded-full border-2 border-white bg-brand-600 ring-1 ring-brand-200" /></div><span className="text-xs leading-5 text-slate-700">{item.event}</span></div>)}</div></Card>
          <Card><CardHeader title="Job & Source Details" description="Verification, original sources and normalized opportunity data." /><div className="grid gap-4 p-5 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Technologies</p><div className="mt-2 flex flex-wrap gap-1">{lead.technologies.map((item) => <Tag key={item}>{item}</Tag>)}</div></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Salary</p><p className="mt-2 text-sm font-bold">{lead.salaryRange}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sources</p><p className="mt-2 text-xs text-slate-600">{lead.sources.join(" · ")}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Data Confidence</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><ShieldCheck className="h-4 w-4" />{lead.confidence} · Deduplicated from {lead.sourcesCount} sources</p></div></div></Card>
        </div>
        <div><ScoreBreakdown breakdown={lead.scoreBreakdown} score={lead.leadScore} /></div>
      </div>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} leads={[lead]} />
    </>
  );
}
