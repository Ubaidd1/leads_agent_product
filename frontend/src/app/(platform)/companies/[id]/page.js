"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { IntentBadge, ScoreBadge, StatusPill, Tag } from "@/components/ui/Badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { companiesApi } from "@/lib/api/catalog";
import { useApi } from "@/lib/useApi";
import { barStyle } from "@/lib/ui";
import { formatDate, formatSalary, timeAgo } from "@/lib/format";

export default function CompanyDetailPage() {
  const { id } = useParams();
  const [tab, setTab] = useState("overview");
  const company = useApi((signal) => companiesApi.get(id, { signal }), [id]);

  if (company.error?.status === 404) return <EmptyState icon={Building2} title="Company not found" description="This company does not exist or is not available in your current workspace." action={<Link href="/companies"><Button>Back to Companies</Button></Link>} />;
  if (company.error) return <ErrorState error={company.error} onRetry={company.reload} title="Could not load this company" />;
  if (!company.data) return <div className="space-y-5"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;

  const data = company.data;
  const activity = data.activity || [];
  const activityMax = Math.max(1, ...activity.map((point) => point.value));
  const website = data.domain ? `https://${data.domain}` : data.careersUrl;
  const facts = [
    ["Intent Score", data.intentScore != null ? `${data.intentScore}/100` : null],
    ["Open Roles", data.openRoles],
    ["Relevant Roles", data.relevantRoles],
    ["Hiring Velocity", data.hiringVelocityPct != null ? `${data.hiringVelocityPct > 0 ? "+" : ""}${data.hiringVelocityPct}%` : null]
  ];

  return (
    <>
      <div className="mb-4 text-xs text-slate-500"><Link href="/companies" className="inline-flex items-center gap-1 font-semibold"><ArrowLeft className="h-3.5 w-3.5" />Companies</Link> / <span className="font-semibold text-slate-700">{data.name}</span></div>
      <Card className="p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row">
          <div className="flex gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-sm font-black text-brand-700">{data.logo}</span><div><h1 className="text-2xl font-black text-slate-900">{data.name}</h1><p className="mt-1 text-sm text-slate-500">{[data.industry, data.location, data.sizeRange].filter(Boolean).join(" · ") || "No company details recorded"}</p><div className="mt-2 flex gap-2"><IntentBadge intent={data.intent} />{data.isDemo ? <StatusPill tone="amber">Demo data</StatusPill> : null}</div></div></div>
          {website ? <a href={website} target="_blank" rel="noreferrer noopener"><Button variant="primary">{data.domain ? "Visit website" : "Careers page"}<ExternalLink className="h-4 w-4" /></Button></a> : null}
        </div>
        <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">{facts.map(([label, value]) => <div key={label}><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-lg font-black ${value == null ? "text-slate-300" : "text-slate-900"}`}>{value ?? "Unknown"}</p></div>)}</div>
      </Card>
      <div className="mt-5 flex gap-2 border-b border-slate-200" role="tablist">{[["overview", "Overview"], ["roles", `Open roles (${data.leads.length})`], ["signals", "Hiring signals"]].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`border-b-2 px-3 pb-3 text-xs font-bold ${tab === key ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500"}`}>{label}</button>)}</div>
      {tab === "overview" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <Card><CardHeader title="Company Overview" description="Context for current hiring demand." /><div className="p-5 text-sm leading-7 text-slate-600">{data.overview || "No overview recorded for this company."}</div></Card>
          <Card><CardHeader title="Hiring Momentum" description="Recorded hiring activity by period." /><div className="p-5">{activity.length ? <div className="space-y-4">{activity.slice(-6).map((point) => <div key={point.period}><div className="mb-1 flex justify-between text-[11px] font-semibold"><span className="text-slate-500">{point.period}</span><span>{point.value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={barStyle(point.value, activityMax)} /></div></div>)}</div> : <p className="text-xs text-slate-500">No activity history recorded yet.</p>}</div></Card>
        </div>
      ) : null}
      {tab === "roles" ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{data.leads.length ? data.leads.map((lead) => <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between border-b border-slate-100 p-4 last:border-0 hover:bg-slate-50"><div><p className="text-sm font-bold text-slate-900">{lead.jobTitle}</p><p className="mt-1 text-xs text-slate-500">{lead.remoteFit || "Remote policy not stated"} · {formatSalary(lead.salaryMin, lead.salaryMax, lead.salaryCurrency)}</p><div className="mt-2 flex gap-1">{lead.technologies.slice(0, 4).map((item) => <Tag key={item}>{item}</Tag>)}</div></div><ScoreBadge score={lead.leadScore} /></Link>) : <div className="p-10 text-center text-sm text-slate-500">No open roles from this company are visible in your workspace.</div>}</div>
      ) : null}
      {tab === "signals" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid content-start gap-4 sm:grid-cols-2">{[["Skill Concentration", data.skillConcentration], ["Departments", data.departments.join(" + ") || null], ["Repeated Hiring", data.repeatedHiringSummary], ["Remote Policy", data.remotePolicy]].map(([label, value]) => <Card key={label} className="p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-2 text-sm font-bold leading-6 ${value ? "text-slate-800" : "text-slate-300"}`}>{value || "Unknown"}</p></Card>)}</div>
          <Card><CardHeader title="Signal timeline" description={`Last updated ${formatDate(data.updatedAt)}`} /><div className="divide-y divide-slate-100">{data.signals.length ? data.signals.map((signal, index) => <div key={index} className="flex justify-between gap-3 px-5 py-3"><p className="text-xs leading-5 text-slate-700">{signal.description}</p><span className="shrink-0 text-[10px] text-slate-400">{timeAgo(signal.occurredAt)}</span></div>) : <p className="p-5 text-xs text-slate-500">No hiring signals recorded yet.</p>}</div></Card>
        </div>
      ) : null}
    </>
  );
}
