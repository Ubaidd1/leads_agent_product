"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { savedSearches } from "@/data/savedSearches";
import { leads } from "@/data/leads";
import LeadTable from "@/components/leads/LeadTable";

export default function SavedSearchDetailPage(){const {id}=useParams();const item=savedSearches.find((search)=>search.id===id)||savedSearches[0];return <><div className="mb-4"><Link href="/saved-searches" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5"/>Saved Searches</Link></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-600">Saved search</p><h1 className="mt-1 text-2xl font-black text-slate-900">{item.name}</h1><p className="mt-2 text-sm text-slate-500">{item.summary}</p><div className="mt-4 flex gap-6 text-xs"><span>New matches <strong className="text-emerald-700">+{item.newMatches}</strong></span><span>Total matches <strong>{item.totalMatches}</strong></span><span>Frequency <strong>{item.frequency}</strong></span></div></div><div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><LeadTable leads={leads.slice(0,5)} onSave={()=>{}}/></div></>}
