"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import MetricCard from "@/components/ui/MetricCard";
import RangeSelect, { rangeQuery } from "@/components/ui/RangeSelect";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState, Skeleton, SkeletonCards } from "@/components/ui/States";
import { analyticsApi } from "@/lib/api/analytics";
import { useApi } from "@/lib/useApi";
import { barStyle } from "@/lib/ui";
import { formatChange, formatNumber, percent } from "@/lib/format";

function Bars({ state, tone = "bg-brand-600", empty, unit = "listings" }) {
  if (state.error) return <div className="p-5"><ErrorState error={state.error} onRetry={state.reload} /></div>;
  if (!state.data) return <div className="p-5"><Skeleton className="h-40" /></div>;
  const items = state.data.items.filter((item) => item.count > 0);
  if (!items.length) return <p className="p-5 text-xs text-slate-500">{empty}</p>;
  const max = Math.max(...items.map((item) => item.count));
  return (
    <div className="space-y-4 p-5">
      {items.map((item) => (
        <div key={item.key}>
          <div className="mb-1.5 flex justify-between text-xs font-semibold"><span>{item.key}</span><span className="text-slate-400">{item.count} {unit}{item.share != null ? ` · ${percent(item.share)}` : ""}</span></div>
          <div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone}`} style={barStyle(item.count, max)} /></div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const query = rangeQuery(days);
  const opts = { keepPrevious: true };
  const overview = useApi((signal) => analyticsApi.overview(query, { signal }), [days], opts);
  const tech = useApi((signal) => analyticsApi.technologies({ ...query, limit: 8 }, { signal }), [days], opts);
  const industries = useApi((signal) => analyticsApi.industries({ ...query, limit: 8 }, { signal }), [days], opts);
  const seniority = useApi((signal) => analyticsApi.seniority(query, { signal }), [days], opts);
  const scores = useApi((signal) => analyticsApi.scoreDistribution(query, { signal }), [days], opts);
  const o = overview.data;

  return (
    <>
      <PageHeader eyebrow="Market intelligence" title="Analytics" description="Trends across technologies, industries, remote eligibility and lead quality, calculated from the leads visible to this workspace." actions={<RangeSelect value={days} onChange={setDays} />} />
      {overview.error ? <ErrorState error={overview.error} onRetry={overview.reload} title="Could not load analytics" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {!o ? <SkeletonCards count={4} /> : (
            <>
              <MetricCard label="Monitored Companies" value={formatNumber(o.monitoredCompanies)} note={`${formatNumber(o.openLeads)} open leads`} />
              <MetricCard label="Verified Signals" value={formatNumber(o.verifiedSignals.value)} change={formatChange(o.verifiedSignals.changePct)} note={`hiring events in the last ${days} days`} />
              <MetricCard label="Remote Acceptance" value={o.remoteAcceptance == null ? "—" : percent(o.remoteAcceptance)} note="open leads open to worldwide, international or Pakistan-based candidates" />
              <MetricCard label="Average Lead Score" value={o.averageScore ?? "—"} note="across scored open leads" />
            </>
          )}
        </div>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card><CardHeader title="Top Demand Technologies" description={`Open leads first seen in the last ${days} days, by technology.`} /><Bars state={tech} empty="No new leads with technologies in this range." /></Card>
        <Card><CardHeader title="Companies by Industry" description="Companies with open leads." /><Bars state={industries} tone="bg-emerald-500" unit="companies" empty="No companies with open leads yet." /></Card>
        <Card><CardHeader title="Seniority Mix" description="Open leads by seniority." /><Bars state={seniority} tone="bg-amber-500" unit="leads" empty="No open leads yet." /></Card>
        <Card><CardHeader title="Lead Score Distribution" description="Open leads by score band." /><Bars state={{ ...scores, data: scores.data && { items: [...scores.data.items].reverse() } }} tone="bg-slate-500" unit="leads" empty="No open leads yet." /></Card>
      </div>
    </>
  );
}
