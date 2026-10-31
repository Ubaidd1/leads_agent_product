"use client";

import Link from "next/link";
import { Download, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import MetricCard from "@/components/ui/MetricCard";
import PageHeader from "@/components/ui/PageHeader";
import RangeSelect, { rangeQuery } from "@/components/ui/RangeSelect";
import { IntentBadge, ScoreBadge, Tag } from "@/components/ui/Badge";
import { ErrorState, Skeleton, SkeletonCards } from "@/components/ui/States";
import ExportModal from "@/components/leads/ExportModal";
import { analyticsApi } from "@/lib/api/analytics";
import { useApi } from "@/lib/useApi";
import { barStyle } from "@/lib/ui";
import { formatChange, formatNumber, percent, timeAgo } from "@/lib/format";

const INTENT_ROWS = [["strong", "High intent", "text-emerald-700", "bg-emerald-500"], ["medium", "Medium intent", "text-amber-700", "bg-amber-500"], ["low", "Low intent", "text-slate-600", "bg-slate-400"], ["unknown", "Not yet assessed", "text-slate-400", "bg-slate-300"]];

function weekLabel(period) {
  return new Date(`${period}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [days, setDays] = useState(30);
  const dashboard = useApi((signal) => analyticsApi.dashboard(rangeQuery(days), { signal }), [days], { revalidateOnFocus: true, keepPrevious: true });
  const data = dashboard.data;
  const kpis = data?.kpis;
  const velocityMax = Math.max(1, ...(data?.velocity || []).map((point) => point.value));
  const intentTotal = (data?.intentDistribution || []).reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <>
      <PageHeader eyebrow="Intelligence workspace" title="Hiring Intelligence" description="Discover companies showing strong, recent hiring demand and turn those signals into qualified business-development opportunities." actions={<><RangeSelect value={days} onChange={setDays} /><Button onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />Export leads</Button><Link href="/search/new"><Button variant="primary"><Plus className="h-4 w-4" />New search</Button></Link></>} />

      {dashboard.error ? <ErrorState error={dashboard.error} onRetry={dashboard.reload} title="Could not load the dashboard" /> : (
        <div className={dashboard.loading && data ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {!kpis ? <SkeletonCards count={4} /> : (
              <>
                <MetricCard label="Qualified Leads" value={formatNumber(kpis.qualifiedLeads.value)} note={`open leads scoring ${data.qualifiedThreshold}+`} hint="Open leads visible to this workspace with a score at or above the workspace's qualified threshold." />
                <MetricCard label="High-Intent Companies" value={formatNumber(kpis.highIntentCompanies.value)} note="strong intent with an open role" hint="Companies with strong hiring intent that have at least one open lead." />
                <MetricCard label="New Leads" value={formatNumber(kpis.newLeads.value)} change={formatChange(kpis.newLeads.changePct)} note={`first seen in the last ${days} days${kpis.newLeads.changePct == null ? " · no prior data to compare" : " vs previous period"}`} hint="Leads first seen during the selected range, compared with the same-length period before it." />
                <MetricCard label="Average Lead Score" value={kpis.averageScore.value ?? "—"} note={kpis.averageScore.value == null ? "no scored open leads" : "across scored open leads"} hint="Mean score of open leads that have been scored." />
              </>
            )}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader title="Hiring Velocity" description="New leads first seen per week, last eight weeks." />
              <div className="px-5 pb-5 pt-6">
                {!data ? <Skeleton className="h-48" /> : (
                  <div className="flex h-48 items-end gap-3 border-b border-slate-100">
                    {data.velocity.map((point) => <div key={point.period} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-semibold text-slate-400">{point.value}</span><div className="w-full max-w-12 rounded-t-lg bg-brand-100 transition hover:bg-brand-600" style={{ height: `${Math.max(2, (point.value / velocityMax) * 85)}%` }} title={`${point.value} new leads, week of ${weekLabel(point.period)}`} /><span className="text-[10px] font-semibold text-slate-400">{weekLabel(point.period)}</span></div>)}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>{data?.dataFreshness ? `Most recent lead activity ${timeAgo(data.dataFreshness)}.` : "No lead activity recorded yet."}</span>
                  {kpis ? <span className="font-bold text-emerald-700">{kpis.verificationRate == null ? "Verification rate: no new leads" : `${percent(kpis.verificationRate, 1)} verification rate`}</span> : null}
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader title="Hiring Intent Overview" description="Companies with open leads, by hiring intent." />
              <div className="space-y-5 p-5">
                {!data ? <Skeleton className="h-40" /> : INTENT_ROWS.map(([key, label, textTone, barTone]) => {
                  const bucket = data.intentDistribution.find((item) => item.key === key) || { count: 0 };
                  if (key === "unknown" && !bucket.count) return null;
                  return <div key={key}><div className="mb-2 flex justify-between text-xs font-semibold"><span className="text-slate-700">{label}</span><span className={textTone}>{bucket.count} {bucket.count === 1 ? "company" : "companies"}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${barTone}`} style={barStyle(bucket.count, intentTotal)} /></div></div>;
                })}
                <Link href="/companies" className="inline-flex text-xs font-bold text-brand-600 hover:text-brand-700">Inspect company intelligence →</Link>
              </div>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.7fr_0.7fr]">
            <Card className="overflow-hidden">
              <CardHeader title="Top Opportunities" description="Highest-scoring open leads." action={<Link href="/leads" className="text-xs font-bold text-brand-600">View all leads →</Link>} />
              <div className="divide-y divide-slate-100">
                {!data ? <div className="p-4"><Skeleton className="h-40" /></div> : data.topLeads.length ? data.topLeads.map((lead) => <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-[11px] font-black text-slate-700">{lead.companyLogo}</span><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">{lead.jobTitle}</p><p className="mt-1 text-[11px] text-slate-500">{lead.companyName}{lead.remoteFit ? ` · ${lead.remoteFit}` : ""}</p><div className="mt-2 flex gap-1">{lead.technologies.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}</div></div></div><div className="flex shrink-0 items-center gap-2"><IntentBadge intent={lead.hiringIntent} /><ScoreBadge score={lead.leadScore} /></div></Link>) : <p className="p-5 text-xs text-slate-500">No open leads yet.</p>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Recent Signals" description="Latest company-level hiring events." />
              <div className="space-y-4 p-5">
                {!data ? <Skeleton className="h-40" /> : data.recentActivity.length ? data.recentActivity.slice(0, 6).map((item, index) => <Link key={`${item.occurredAt}-${index}`} href={item.leadId ? `/leads/${item.leadId}` : `/companies/${item.companySlug}`} className="flex gap-3"><span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><Sparkles className="h-3.5 w-3.5" /></span><div><p className="text-xs font-semibold leading-5 text-slate-800">{item.companyName}: {item.description}</p><p className="mt-0.5 text-[10px] text-slate-400">{timeAgo(item.occurredAt)}</p></div></Link>) : <p className="text-xs text-slate-500">No hiring signals recorded yet.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} criteria={{}} />
    </>
  );
}
