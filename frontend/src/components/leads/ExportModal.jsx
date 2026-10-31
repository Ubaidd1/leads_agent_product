"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { exportsApi } from "@/lib/api/exports";
import { criteriaSummary, criteriaToSaved } from "@/lib/criteria";
import { useToast } from "@/components/providers/ToastProvider";

const POLL_MS = 2000;

/**
 * Creates a server-side export from either the current filters (`criteria`) or explicit `leadIds`.
 * The server re-applies workspace visibility when it builds the file, so the count it reports is the
 * real number of rows; `count` here is only the estimate shown before starting.
 */
export default function ExportModal({ open, onClose, criteria, leadIds, count }) {
  const { notify } = useToast();
  const [format, setFormat] = useState("csv");
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!open) { setJob(null); setError(""); setBusy(false); clearTimeout(pollRef.current); }
    return () => clearTimeout(pollRef.current);
  }, [open]);

  function poll(id) {
    pollRef.current = setTimeout(async () => {
      try {
        const next = await exportsApi.get(id);
        setJob(next);
        if (next.status === "queued" || next.status === "running") poll(id);
      } catch (err) {
        setError(err.message);
      }
    }, POLL_MS);
  }

  async function start() {
    setError("");
    setBusy(true);
    try {
      // The idempotency key makes a double click or retry return the same job instead of a second file.
      const body = { format, idempotencyKey: crypto.randomUUID(), ...(leadIds ? { leadIds } : { filters: criteriaToSaved(criteria || {}) }) };
      const created = await exportsApi.create(body);
      setJob(created);
      if (created.status === "succeeded") {
        window.location.assign(exportsApi.downloadUrl(created.id));
        notify(`Export ready: ${created.recordCount} leads.`);
      } else if (created.status === "queued" || created.status === "running") poll(created.id);
    } catch (err) {
      setError(Object.values(err.fieldErrors)[0] || err.message);
    } finally {
      setBusy(false);
    }
  }

  const scope = leadIds ? `${leadIds.length} selected lead${leadIds.length === 1 ? "" : "s"}` : criteriaSummary(criteria || {});
  return (
    <Modal open={open} onClose={onClose} title="Export qualified leads" description="The server builds the file from the same filters and permissions as Lead Discovery.">
      <div className="space-y-4">
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div> : null}
        {!job ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setFormat("csv")} className={`rounded-xl border p-3 text-left text-sm font-semibold ${format === "csv" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}><span className="block">CSV</span><span className="mt-1 block text-[10px] font-normal text-slate-400">Universal spreadsheet format</span></button>
              <button onClick={() => setFormat("xlsx")} className={`rounded-xl border p-3 text-left text-sm font-semibold ${format === "xlsx" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}><span className="block">Excel (.xlsx)</span><span className="mt-1 block text-[10px] font-normal text-slate-400">Native Excel workbook</span></button>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="flex justify-between gap-4"><span>Scope</span><strong className="text-right text-slate-900">{scope}</strong></div>
              {count != null ? <div className="flex justify-between"><span>Matching leads now</span><strong className="text-slate-900">{count.toLocaleString()}</strong></div> : null}
              <div className="flex justify-between"><span>Includes score, sources and verification</span><strong className="text-emerald-700">Yes</strong></div>
            </div>
            <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || count === 0} onClick={start}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Generate export</Button></div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              {job.status === "succeeded" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : job.status === "failed" ? <XCircle className="mt-0.5 h-5 w-5 text-rose-600" /> : <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-brand-600" />}
              <div>
                <p className="font-bold text-slate-900">{job.status === "succeeded" ? `${job.recordCount.toLocaleString()} leads exported` : job.status === "failed" ? "Export failed" : job.status === "queued" ? "Export queued" : "Generating export…"}</p>
                <p className="mt-1 text-xs text-slate-500">{job.status === "succeeded" ? "Your download should start automatically." : job.status === "failed" ? job.errorMessage || "The file could not be generated." : "Large exports are built in the background. You can close this and find it on the Exports page."}</p>
                {job.skippedCount ? <p className="mt-1 text-xs text-amber-700">{job.skippedCount} requested lead{job.skippedCount === 1 ? " was" : "s were"} no longer visible to this workspace and were left out.</p> : null}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Link href="/exports"><Button onClick={onClose}>Go to Exports</Button></Link>
              {job.status === "succeeded" ? <a href={exportsApi.downloadUrl(job.id)}><Button variant="primary"><Download className="h-4 w-4" />Download again</Button></a> : <Button variant="primary" onClick={onClose}>Close</Button>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
