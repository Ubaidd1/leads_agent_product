"use client";

import Link from "next/link";
import { Download, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { companies } from "@/data/companies";
import { leads } from "@/data/leads";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import PageHeader from "@/components/ui/PageHeader";
import { IntentBadge, ScoreBadge, Tag } from "@/components/ui/Badge";
import ExportModal from "@/components/leads/ExportModal";
import { progressWidth } from "@/lib/ui";

const velocity = [34, 41, 38, 52, 61, 72, 83, 94];
const heightClasses = ["h-[34%]", "h-[41%]", "h-[38%]", "h-[52%]", "h-[61%]", "h-[72%]", "h-[83%]", "h-[94%]"];

export default function DashboardPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const highIntent = companies.filter((company) => company.intent === "Strong").length;

  return (
    <>
      <PageHeader eyebrow="Intelligence workspace" title="Hiring Intelligence" description="Discover companies showing strong, recent hiring demand and turn those signals into qualified business-development opportunities." actions={<><Button onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />Export leads</Button><Link href="/search/new"><Button variant="primary"><Plus className="h-4 w-4" />New search</Button></Link></>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Qualified Leads" value="1,284" change="+14.2%" note="vs previous 30 days" />
        <MetricCard label="High-Intent Companies" value="186" change="+8.4%" note={`${highIntent} strong-intent demo firms`} />
        <MetricCard label="New This Week" value="342" change="+21.5%" note="verified fresh listings" />
        <MetricCard label="Average Lead Score" value="82" change="+3.1" note="transparent weighted score" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Hiring Velocity" description="Qualified hiring signals detected over the last eight weeks." action={<span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">+31% momentum</span>} />
          <div className="px-5 pb-5 pt-6">
            <div className="flex h-48 items-end gap-3 border-b border-slate-100">
              {velocity.map((value, index) => <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-semibold text-slate-400">{value}</span><div className={`w-full max-w-12 rounded-t-lg bg-brand-100 transition hover:bg-brand-600 ${heightClasses[index]}`} /><span className="text-[10px] font-semibold text-slate-400">W{index + 1}</span></div>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500"><span>Deduplicated across approved sources and company career pages.</span><span className="font-bold text-emerald-700">99.2% verification rate</span></div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Hiring Intent Overview" description="Company-level commercial readiness." />
          <div className="space-y-5 p-5">
            {[['High intent',186,72,'text-emerald-700','bg-emerald-500'],['Medium intent',394,52,'text-amber-700','bg-amber-500'],['Low intent',704,35,'text-slate-600','bg-slate-400']].map(([label,count,pct,textTone,barTone]) => <div key={label}><div className="mb-2 flex justify-between text-xs font-semibold"><span className="text-slate-700">{label}</span><span className={textTone}>{count} companies</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${barTone} ${progressWidth(pct)}`} /></div></div>)}
            <Link href="/companies" className="inline-flex text-xs font-bold text-brand-600 hover:text-brand-700">Inspect company intelligence →</Link>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.7fr_0.7fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Top Opportunities" description="Highest-scoring leads by commercial relevance, freshness and hiring intent." action={<Link href="/leads" className="text-xs font-bold text-brand-600">View all leads →</Link>} />
          <div className="divide-y divide-slate-100">
            {leads.slice(0,5).map((lead) => <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-[11px] font-black text-slate-700">{lead.companyLogo}</span><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">{lead.jobTitle}</p><p className="mt-1 text-[11px] text-slate-500">{lead.companyName} · {lead.remoteFit}</p><div className="mt-2 flex gap-1">{lead.technologies.slice(0,3).map((item) => <Tag key={item}>{item}</Tag>)}</div></div></div><div className="flex shrink-0 items-center gap-2"><IntentBadge intent={lead.hiringIntent} /><ScoreBadge score={lead.leadScore} /></div></Link>)}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent Signals" description="Fresh company-level changes." />
          <div className="space-y-4 p-5">
            {["Northstar-style AI firm added 4 engineering roles","CloudNova hiring velocity increased 37%","NovaStack published 3 React positions","VectorPay reopened a backend role","Aster expanded QA hiring"].map((text, index) => <div key={text} className="flex gap-3"><span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><Sparkles className="h-3.5 w-3.5" /></span><div><p className="text-xs font-semibold leading-5 text-slate-800">{text}</p><p className="mt-0.5 text-[10px] text-slate-400">{index * 12 + 6} min ago</p></div></div>)}
          </div>
        </Card>
      </div>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} leads={leads} />
    </>
  );
}
