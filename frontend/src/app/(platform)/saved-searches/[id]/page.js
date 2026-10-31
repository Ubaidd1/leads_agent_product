"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookmarkX, Loader2, Pencil, Play } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Skeleton, SkeletonRows } from "@/components/ui/States";
import LeadTable from "@/components/leads/LeadTable";
import CriteriaForm, { MatchEstimate } from "@/components/leads/CriteriaForm";
import { FREQUENCIES } from "@/components/leads/SaveSearchModal";
import { useToast } from "@/components/providers/ToastProvider";
import { announceAlertsChanged } from "@/components/layout/NotificationBell";
import { savedSearchesApi } from "@/lib/api/saved-searches";
import { useApi } from "@/lib/useApi";
import { useLeadSave } from "@/lib/useLeadSave";
import { criteriaFromSaved, criteriaSummary, criteriaToSaved, runSummary } from "@/lib/criteria";
import { formatDateTime, timeAgo, titleCase } from "@/lib/format";

function EditPanel({ search, onSaved, onCancel }) {
  const { notify } = useToast();
  const [form, setForm] = useState({ name: search.name, frequency: search.frequency, notifyInApp: search.notifyInApp, notifyEmail: search.notifyEmail });
  const [criteria, setCriteria] = useState(criteriaFromSaved(search.criteria));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await savedSearchesApi.update(search.id, { ...form, criteria: criteriaToSaved(criteria) });
      notify("Saved search updated.");
      onSaved(updated);
    } catch (err) {
      setError(err.status === 409 ? "A saved search with this name already exists." : Object.values(err.fieldErrors)[0] || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">Edit saved search</h2>
      <p className="mt-1 text-xs text-slate-500">Changing the criteria starts the “new matches” history over.</p>
      {error ? <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">Name<input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-bold text-slate-700">Run frequency<select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">{FREQUENCIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.notifyInApp} onChange={(e) => setForm({ ...form, notifyInApp: e.target.checked })} className="accent-brand-600" />In-app alerts for new matches</label>
        <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.notifyEmail} onChange={(e) => setForm({ ...form, notifyEmail: e.target.checked })} className="accent-brand-600" />Email alerts (sent once an email provider is configured)</label>
      </div>
      <div className="mt-6 border-t border-slate-100 pt-5"><CriteriaForm criteria={criteria} onChange={setCriteria} /></div>
      <div className="mt-5"><MatchEstimate criteria={criteria} /></div>
      <div className="mt-5 flex justify-end gap-2"><Button type="button" onClick={onCancel}>Cancel</Button><Button variant="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button></div>
    </form>
  );
}

export default function SavedSearchDetailPage() {
  const { id } = useParams();
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const search = useApi((signal) => savedSearchesApi.get(id, { signal }), [id]);
  const results = useApi(search.data ? (signal) => savedSearchesApi.results(id, { page, pageSize: 25 }, { signal }) : null, [id, page, search.data?.lastRunId, search.data?.updatedAt, search.data?.latestRun?.id], { keepPrevious: true });
  const runs = useApi((signal) => savedSearchesApi.runs(id, { pageSize: 10 }, { signal }), [id, search.data?.latestRun?.id]);

  const applySaved = useCallback((leadId, isSaved) => results.setData((data) => data && { ...data, items: data.items.map((lead) => (lead.id === leadId ? { ...lead, isSaved } : lead)) }), [results.setData]); // eslint-disable-line react-hooks/exhaustive-deps
  const { toggle, pending } = useLeadSave(applySaved);
  useEffect(() => setPage(1), [search.data?.updatedAt]);

  async function runNow() {
    setRunning(true);
    try {
      const run = await savedSearchesApi.run(id);
      if (run.status === "failed") notify(run.errorMessage || "The run failed.", "error");
      else notify(`Run finished: ${runSummary(run)}.`);
      if (run.newCount) announceAlertsChanged();
      await search.reload({ quiet: true });
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setRunning(false);
    }
  }

  if (search.error?.status === 404) return <EmptyState icon={BookmarkX} title="Saved search not found" description="It may have been deleted, or it belongs to another workspace." action={<Link href="/saved-searches"><Button>Back to Saved Searches</Button></Link>} />;
  if (search.error) return <ErrorState error={search.error} onRetry={search.reload} />;
  if (!search.data) return <div className="space-y-5"><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  const item = search.data;
  const newIds = new Set((results.data?.items || []).filter((lead) => lead.isNew).map((lead) => lead.id));

  return (
    <>
      <div className="mb-4"><Link href="/saved-searches" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />Saved Searches</Link></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-600">Saved search</p><h1 className="mt-1 text-2xl font-black text-slate-900">{item.name}</h1><p className="mt-2 text-sm text-slate-500">{criteriaSummary(criteriaFromSaved(item.criteria))}</p></div>
          <div className="flex gap-2">{item.canEdit ? <Button onClick={() => setEditing((value) => !value)}><Pencil className="h-4 w-4" />Edit</Button> : null}<Button variant="primary" disabled={running} onClick={runNow}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run now</Button></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <span>New matches <strong className="text-emerald-700">{item.lastNewCount == null ? "—" : `+${item.lastNewCount}`}</strong></span>
          <span>Total matches <strong>{item.lastResultCount ?? "—"}</strong></span>
          <span>Frequency <strong>{titleCase(item.frequency)}</strong>{!item.scheduling.enabled && item.frequency !== "manual" ? <span className="ml-1 text-amber-700">(scheduled runs not yet active)</span> : null}</span>
          <span>Last run <strong>{item.lastRunAt ? timeAgo(item.lastRunAt) : "never"}</strong></span>
          <span className="flex gap-1">{item.isActive ? <StatusPill tone="emerald">Active</StatusPill> : <StatusPill>Paused</StatusPill>}{item.notificationsPaused ? <StatusPill tone="amber">Alerts paused</StatusPill> : null}</span>
        </div>
      </div>
      {editing ? <EditPanel search={item} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); search.reload({ quiet: true }); }} /> : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-bold text-slate-900">Current matches</h2><p className="mt-1 text-xs text-slate-500">Live results for these criteria. “New” marks leads first matched by the latest run.</p></div>
        {results.error ? <div className="p-5"><ErrorState error={results.error} onRetry={results.reload} /></div>
          : !results.data ? <SkeletonRows rows={5} />
          : results.data.items.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No open leads match these criteria right now.</p>
          : <><LeadTable leads={results.data.items} onSave={toggle} pendingIds={pending} newIds={newIds} /><Pagination page={results.data.page} pageSize={results.data.pageSize} total={results.data.total} totalPages={results.data.totalPages} onPage={setPage} noun="leads" /></>}
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Run history" description="Every run of this search, newest first." />
        {runs.error ? <div className="p-5"><ErrorState error={runs.error} onRetry={runs.reload} /></div> : !runs.data ? <SkeletonRows rows={3} /> : runs.data.items.length === 0 ? <p className="p-5 text-xs text-slate-500">This search has not been run yet.</p> : (
          <div className="divide-y divide-slate-100">{runs.data.items.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs"><span className="flex items-center gap-2"><StatusPill tone={run.status === "succeeded" ? "emerald" : run.status === "failed" ? "rose" : "slate"}>{titleCase(run.status)}</StatusPill><span className="text-slate-700">{runSummary(run)}</span></span><span className="text-slate-400">{titleCase(run.trigger)} · {formatDateTime(run.startedAt)}</span></div>)}</div>
        )}
      </Card>
    </>
  );
}
