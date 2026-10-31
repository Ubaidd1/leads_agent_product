"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { downloadLeads } from "@/lib/export";
import { useToast } from "@/components/providers/ToastProvider";

export default function ExportModal({ open, onClose, leads }) {
  const [format, setFormat] = useState("csv");
  const { notify } = useToast();
  function runExport() {
    downloadLeads(leads, format);
    notify(`Exported ${leads.length} qualified leads.`);
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title="Export qualified leads" description="Create a sales-ready file from the current lead set.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setFormat("csv")} className={`rounded-xl border p-3 text-left text-sm font-semibold ${format === "csv" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}><span className="block">CSV</span><span className="mt-1 block text-[10px] font-normal text-slate-400">Universal spreadsheet format</span></button>
          <button onClick={() => setFormat("xls")} className={`rounded-xl border p-3 text-left text-sm font-semibold ${format === "xls" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}><span className="block">Excel compatible</span><span className="mt-1 block text-[10px] font-normal text-slate-400">Opens directly in Excel</span></button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><div className="flex justify-between"><span>Records</span><strong className="text-slate-900">{leads.length}</strong></div><div className="mt-2 flex justify-between"><span>Includes score + verification</span><strong className="text-emerald-700">Yes</strong></div></div>
        <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={runExport}><Download className="h-4 w-4" />Generate & download</Button></div>
      </div>
    </Modal>
  );
}
