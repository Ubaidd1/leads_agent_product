"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Plus } from "lucide-react";
import { leads } from "@/data/leads";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import ExportModal from "@/components/leads/ExportModal";
import { downloadLeads } from "@/lib/export";

const history=[{id:1,name:"react-qualified-leads.csv",format:"CSV",count:148,created:"Today · 11:20"},{id:2,name:"ai-high-intent.xls",format:"Excel",count:84,created:"Yesterday"},{id:3,name:"remote-engineering.csv",format:"CSV",count:242,created:"Oct 12, 2026"}];
export default function ExportsPage(){const [open,setOpen]=useState(false);return <><PageHeader eyebrow="Sales-ready delivery" title="Exports" description="Generate enriched CSV or Excel-compatible lead files for outbound workflows." actions={<Button variant="primary" onClick={()=>setOpen(true)}><Plus className="h-4 w-4"/>Create export</Button>}/><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Export</th><th className="px-4 py-3">Format</th><th className="px-4 py-3">Records</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody>{history.map((item)=><tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3"><span className="flex items-center gap-2 text-xs font-bold"><FileSpreadsheet className="h-4 w-4 text-brand-600"/>{item.name}</span></td><td className="px-4 py-3 text-xs text-slate-600">{item.format}</td><td className="px-4 py-3 text-xs font-bold">{item.count}</td><td className="px-4 py-3 text-xs text-slate-500">{item.created}</td><td className="px-4 py-3 text-right"><button onClick={()=>downloadLeads(leads,item.format==="Excel"?"xls":"csv")} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-brand-600 hover:bg-brand-50"><Download className="h-3.5 w-3.5"/>Download</button></td></tr>)}</tbody></table></div><ExportModal open={open} onClose={()=>setOpen(false)} leads={leads}/></>}
