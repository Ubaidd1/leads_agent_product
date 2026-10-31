"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, BookmarkCheck, Download, ExternalLink, SearchX, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { IntentBadge, ScoreBadge, StatusPill, Tag } from "@/components/ui/Badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import ScoreBreakdown from "@/components/leads/ScoreBreakdown";
import ExportModal from "@/components/leads/ExportModal";
import { leadsApi } from "@/lib/api/catalog";
import { useApi } from "@/lib/useApi";
import { useLeadSave } from "@/lib/useLeadSave";
import { formatDate, formatSalary, timeAgo, titleCase } from "@/lib/format";
import { regionLabel } from "@/lib/constants";

function NotFound() {
  return <EmptyState icon={SearchX} title="Lead not found" description="This lead does not exist or is not available in your current workspace." action={<Link href="/leads"><Button>Back to Lead Discovery</Button></Link>} />;
}

function Loading() {
  return <div className="space-y-5"><Skeleton className="h-32 rounded-2xl" /><div className="grid gap-5 xl:grid-cols-[1.55fr_0.85fr]"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div></div>;
}

const VERIFICATION = { verified: ["Verified", "emerald"], high_confidence: ["High confidence", "emerald"], unverified: ["Not verified", "slate"] };

export default function LeadDetailPage() {
  const { id } = useParams();
  const [exportOpen, setExportOpen] = useState(false);
  const lead = useApi((signal) => leadsApi.get(id, { signal }), [id]);
  const apply = useCallback((_, isSaved) => lead.setData((data) => data && { ...data, isSaved }), [lead.setData]); // eslint-disable-line react-hooks/exhaustive-deps
  const { toggle, pending } = useLeadSave(apply);

  if (lead.error?.status === 404 || lead.error?.status === 422) return <NotFound />;
  if (lead.error) return <ErrorState error={lead.error} onRetry={lead.reload} title="Could not load this lead" />;
  if (!lead.data) return <Loading />;
  const data = lead.data;
  const { company } = data;
  const [verificationLabel, verificationTone] = VERIFICATION[data.verificationStatus] || VERIFICATION.unverified;
  const signals = [
    ["Open Roles", company.openRoles],
    ["Relevant Roles", company.relevantRoles],
    ["Hiring Velocity", company.hiringVelocityPct != null ? `${company.hiringVelocityPct > 0 ? "+" : ""}${company.hiringVelocityPct}%` : null],
    ["Skill Concentration", company.skillConcentration],
    ["Departments", company.departments.length ? company.departments.join(" + ") : null],
    ["Repeated Hiring", company.repeatedHiringSummary]
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500"><Link href="/leads" className="inline-flex items-center gap-1 font-semibold hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />Lead Discovery</Link><span>/</span><Link href={`/companies/${company.slug}`} className="hover:text-slate-800">{company.name}</Link><span>/</span><span className="truncate font-semibold text-slate-700">{data.jobTitle}</span></div>
      <Card className="p-5 md:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-sm font-black text-brand-700">{data.companyLogo}</span><div><div className="mb-2 flex flex-wrap gap-2"><IntentBadge intent={data.hiringIntent} />{data.remoteFit ? <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">{data.remoteFit}</span> : null}<span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{data.lastVerifiedAt ? `Verified ${timeAgo(data.lastVerifiedAt)}` : "Not verified yet"}</span>{data.isDemo ? <StatusPill tone="amber">Demo data</StatusPill> : null}</div><h1 className="text-xl font-black text-slate-900 md:text-2xl">{data.jobTitle}</h1><p className="mt-1 text-sm text-slate-500">{[data.companyName, company.industry, company.location, company.sizeRange].filter(Boolean).join(" · ")}</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><ScoreBadge score={data.leadScore} /><Button disabled={pending.has(data.id)} onClick={() => toggle(data)} aria-pressed={data.isSaved}>{data.isSaved ? <BookmarkCheck className="h-4 w-4 text-brand-600" /> : <Bookmark className="h-4 w-4" />}{data.isSaved ? "Saved" : "Save lead"}</Button><Button onClick={() => setExportOpen(true)}><Download className="h-4 w-4" />Export</Button>{data.canonicalUrl ? <a href={data.canonicalUrl} target="_blank" rel="noreferrer noopener"><Button variant="primary">Visit job<ExternalLink className="h-4 w-4" /></Button></a> : null}</div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_0.85fr]">
        <div className="space-y-5">
          <Card><CardHeader title="Why this lead matters" description="Explanation built from the score components and flags." /><div className="p-5"><div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm leading-6 text-slate-700">{data.score?.rationale || "No explanation is available until this lead has been scored."}</div></div></Card>
          <Card><CardHeader title="Hiring Signals" description="Company-level indicators. Blank values mean the data is not known yet." /><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">{signals.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p><p className={`mt-2 text-sm leading-5 ${value == null ? "font-semibold text-slate-400" : "font-black text-slate-800"}`}>{value ?? "Unknown"}</p></div>)}</div></Card>
          <Card><CardHeader title="Hiring Activity Timeline" description="Recent events for this opportunity and its company." /><div className="p-5">{data.timeline.length ? data.timeline.map((item, index) => <div key={`${item.occurredAt}-${index}`} className="grid grid-cols-[90px_18px_1fr] gap-3 pb-5 last:pb-0"><span className="text-[11px] font-semibold text-slate-400" title={formatDate(item.occurredAt)}>{timeAgo(item.occurredAt)}</span><div className="relative"><span className="absolute left-[7px] top-1 h-full w-px bg-slate-200" /><span className="relative z-10 block h-3 w-3 rounded-full border-2 border-white bg-brand-600 ring-1 ring-brand-200" /></div><span className="text-xs leading-5 text-slate-700">{item.description}</span></div>) : <p className="text-xs text-slate-500">No hiring events recorded yet.</p>}</div></Card>
          <Card>
            <CardHeader title="Job & Source Details" description="Normalized opportunity data and every source it was found in." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Technologies</p><div className="mt-2 flex flex-wrap gap-1">{data.technologies.length ? data.technologies.map((item) => <Tag key={item}>{item}</Tag>) : <span className="text-xs text-slate-400">Not extracted</span>}</div></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Salary</p><p className="mt-2 text-sm font-bold">{formatSalary(data.salaryMin, data.salaryMax, data.salaryCurrency)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Eligible regions</p><p className="mt-2 text-xs text-slate-600">{data.regions.length ? data.regions.map(regionLabel).join(" · ") : "Not stated"}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Data confidence</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><ShieldCheck className="h-4 w-4" /><StatusPill tone={verificationTone}>{verificationLabel}</StatusPill>{data.sources.length > 1 ? <span className="ml-1 text-slate-600">· Deduplicated from {data.sources.length} sources</span> : null}</p></div>
              <div className="text-xs text-slate-500 sm:col-span-2">Posted {data.postedAt ? formatDate(data.postedAt) : "date unknown"} · first seen {formatDate(data.firstSeenAt)} · last seen {formatDate(data.lastSeenAt)}{data.seniority ? ` · ${titleCase(data.seniority)}` : ""}</div>
            </div>
            <div className="border-t border-slate-100">
              <p className="px-5 pt-4 text-[10px] font-bold uppercase tracking-wide text-slate-400">Sources ({data.sources.length})</p>
              {data.sources.length ? (
                <ul className="divide-y divide-slate-100 px-5 pb-2">{data.sources.map((source, index) => <li key={`${source.sourceType}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"><div><p className="font-bold text-slate-800">{source.sourceName}<span className="ml-2 font-normal text-slate-400">{source.sourceType === "demo_fixture" ? "demo fixture" : source.sourceType}</span></p><p className="mt-0.5 text-[11px] text-slate-500">First seen {formatDate(source.firstSeenAt)} · last seen {formatDate(source.lastSeenAt)} · {source.verifiedAt ? `verified ${timeAgo(source.verifiedAt)}` : "not verified"}</p></div>{source.sourceUrl ? <a href={source.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-brand-600">Original posting<ExternalLink className="h-3 w-3" /></a> : null}</li>)}</ul>
              ) : <p className="px-5 pb-4 pt-2 text-xs text-slate-500">No source records attached.</p>}
            </div>
          </Card>
        </div>
        <div><ScoreBreakdown score={data.score} /></div>
      </div>
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} leadIds={[data.id]} count={1} />
    </>
  );
}
