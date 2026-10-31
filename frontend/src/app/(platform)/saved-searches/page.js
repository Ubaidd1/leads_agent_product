"use client";

import Link from "next/link";
import { useState } from "react";
import { BookmarkCheck, Copy, Loader2, Pause, Play, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { EmptyState, ErrorState, SkeletonCards } from "@/components/ui/States";
import { useToast } from "@/components/providers/ToastProvider";
import { savedSearchesApi } from "@/lib/api/saved-searches";
import { useApi } from "@/lib/useApi";
import { criteriaFromSaved, criteriaSummary, runSummary } from "@/lib/criteria";
import { timeAgo, titleCase } from "@/lib/format";
import { announceAlertsChanged } from "@/components/layout/NotificationBell";

export default function SavedSearchesPage() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const searches = useApi((signal) => savedSearchesApi.list({ page, pageSize: 20 }, { signal }), [page], { keepPrevious: true });
  const replace = (updated) => searches.setData((data) => data && { ...data, items: data.items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)) });

  async function act(item, key, action) {
    setBusy((state) => ({ ...state, [item.id]: key }));
    try {
      await action();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy((state) => ({ ...state, [item.id]: null }));
    }
  }

  const run = (item) => act(item, "run", async () => {
    const result = await savedSearchesApi.run(item.id);
    if (result.status === "failed") notify(result.errorMessage || "The run failed.", "error");
    else notify(`${item.name}: ${runSummary(result)}.`);
    replace(await savedSearchesApi.get(item.id));
    if (result.newCount) announceAlertsChanged();
  });
  const duplicate = (item) => act(item, "duplicate", async () => {
    const copy = await savedSearchesApi.duplicate(item.id);
    notify(`Created “${copy.name}”.`);
    searches.reload({ quiet: true });
  });
  const toggleActive = (item) => act(item, "active", async () => {
    replace(await savedSearchesApi.update(item.id, { isActive: !item.isActive }));
    notify(item.isActive ? "Saved search paused." : "Saved search resumed.", "info");
  });
  async function remove() {
    const item = confirmDelete;
    setConfirmDelete(null);
    await act(item, "delete", async () => {
      await savedSearchesApi.remove(item.id);
      notify("Saved search deleted.", "info");
      searches.reload({ quiet: true });
    });
  }

  const data = searches.data;
  return (
    <>
      <PageHeader eyebrow="Automated discovery" title="Saved Searches" description="Reusable lead criteria. Run them any time to see what is new since the last run." actions={<Link href="/search/new"><Button variant="primary"><Plus className="h-4 w-4" />New saved search</Button></Link>} />
      {data?.items[0] && !data.items[0].scheduling.enabled ? <p className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">Scheduled runs are not active yet. Daily, weekly and instant searches run only when you press Run.</p> : null}
      {searches.error ? <ErrorState error={searches.error} onRetry={searches.reload} title="Could not load saved searches" />
        : !data ? <div className="grid gap-4 md:grid-cols-2"><SkeletonCards count={4} className="h-48" /></div>
        : data.items.length === 0 ? <EmptyState icon={BookmarkCheck} title="No saved searches yet" description="Save a set of filters from Lead Discovery or the Search Builder to track new matching leads." action={<Link href="/search/new"><Button variant="primary">Create a saved search</Button></Link>} />
        : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {data.items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/saved-searches/${item.id}`} className="text-sm font-black text-slate-900 hover:text-brand-600">{item.name}</Link><p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px] font-semibold text-slate-600">{criteriaSummary(criteriaFromSaved(item.criteria))}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${item.isActive ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{item.isActive ? "Active" : "Paused"}</span></div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">New</p><p className="mt-1 text-lg font-black text-emerald-700">{item.lastNewCount == null ? "—" : `+${item.lastNewCount}`}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Total</p><p className="mt-1 text-lg font-black text-slate-900">{item.lastResultCount ?? "—"}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Frequency</p><p className="mt-1 text-sm font-black text-slate-800">{titleCase(item.frequency)}</p></div></div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-[10px] text-slate-400">{item.lastRunAt ? `Last run ${timeAgo(item.lastRunAt)}${item.lastRunStatus === "failed" ? " · failed" : ""}` : "Never run"}</span>
                    <div className="flex gap-1">
                      <button disabled={!!busy[item.id]} onClick={() => run(item)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50" aria-label={`Run ${item.name}`} title="Run now">{busy[item.id] === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}</button>
                      <button disabled={!!busy[item.id]} onClick={() => duplicate(item)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50" aria-label={`Duplicate ${item.name}`} title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
                      {item.canEdit ? <button disabled={!!busy[item.id]} onClick={() => toggleActive(item)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50" aria-label={item.isActive ? `Pause ${item.name}` : `Resume ${item.name}`} title={item.isActive ? "Pause" : "Resume"}>{item.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-emerald-600" />}</button> : null}
                      {item.canEdit ? <button disabled={!!busy[item.id]} onClick={() => setConfirmDelete(item)} className="rounded-lg border border-rose-100 p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-50" aria-label={`Delete ${item.name}`} title="Delete"><Trash2 className="h-3.5 w-3.5" /></button> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {data.totalPages > 1 ? <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages} onPage={setPage} noun="saved searches" /></div> : null}
          </>
        )}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete saved search?" description={confirmDelete ? `“${confirmDelete.name}” and its run history will be permanently deleted.` : ""}>
        <div className="flex justify-end gap-2"><Button onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete</Button></div>
      </Modal>
    </>
  );
}
