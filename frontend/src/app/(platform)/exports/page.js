"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { StatusPill } from "@/components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import ExportModal from "@/components/leads/ExportModal";
import { exportsApi } from "@/lib/api/exports";
import { useApi } from "@/lib/useApi";
import { criteriaFromSaved, criteriaSummary } from "@/lib/criteria";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";

const TONES = { succeeded: "emerald", queued: "slate", running: "brand", failed: "rose", expired: "slate" };

export default function ExportsPage() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const history = useApi((signal) => exportsApi.list({ page, pageSize: 25 }, { signal }), [page, open], { keepPrevious: true });
  const data = history.data;
  const inProgress = data?.items.some((item) => item.status === "queued" || item.status === "running");

  // Poll while any export is still being generated; slow down when the tab is hidden.
  const reload = history.reload;
  useEffect(() => {
    if (!inProgress) return undefined;
    const timer = setInterval(() => reload({ quiet: true }), document.visibilityState === "visible" ? 3000 : 15000);
    return () => clearInterval(timer);
  }, [inProgress, reload]);

  return (
    <>
      <PageHeader eyebrow="Sales-ready delivery" title="Exports" description="Server-generated CSV and Excel files with scores, sources and verification. Files are kept for 7 days." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Create export</Button>} />
      {history.error ? <ErrorState error={history.error} onRetry={history.reload} title="Could not load export history" />
        : !data ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SkeletonRows rows={4} /></div>
        : data.items.length === 0 ? <EmptyState icon={FileSpreadsheet} title="No exports yet" description="Create an export from Lead Discovery to download the leads matching your filters." action={<Button variant="primary" onClick={() => setOpen(true)}>Create export</Button>} />
        : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead><tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Export</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Records</th><th className="px-4 py-3">Requested by</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Expires</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3"><span className="flex items-center gap-2 text-xs font-bold"><FileSpreadsheet className="h-4 w-4 text-brand-600" />{item.fileName || `${item.format.toUpperCase()} export`}</span><span className="mt-1 block max-w-xs truncate text-[10px] text-slate-400">{item.selection === "ids" ? `${item.requestedCount} selected leads` : criteriaSummary(criteriaFromSaved(item.filters || {}))}</span></td>
                      <td className="px-4 py-3"><StatusPill tone={TONES[item.status]}>{titleCase(item.status)}</StatusPill>{item.status === "failed" && item.errorMessage ? <span className="mt-1 block text-[10px] text-rose-600">{item.errorMessage}</span> : null}</td>
                      <td className="px-4 py-3 text-xs font-bold">{item.recordCount ?? "—"}{item.skippedCount ? <span className="block text-[10px] font-normal text-amber-700">{item.skippedCount} skipped</span> : null}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.requestedByName || "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(item.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{item.expiresAt ? formatDate(item.expiresAt) : "—"}</td>
                      <td className="px-4 py-3 text-right">{item.status === "succeeded" ? <a href={exportsApi.downloadUrl(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-brand-600 hover:bg-brand-50"><Download className="h-3.5 w-3.5" />Download</a> : <span className="text-[11px] text-slate-400">{item.status === "expired" ? "Expired" : item.status === "failed" ? "Unavailable" : "Generating…"}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages} onPage={setPage} noun="exports" />
          </div>
        )}
      <ExportModal open={open} onClose={() => setOpen(false)} criteria={{}} />
    </>
  );
}
