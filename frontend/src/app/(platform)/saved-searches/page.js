"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Play, Plus, Trash2 } from "lucide-react";
import { savedSearches as seedSearches } from "@/data/savedSearches";
import { keys, readStorage, writeStorage } from "@/lib/storage";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";

export default function SavedSearchesPage(){
  const {notify}=useToast(); const [items,setItems]=useState([]);
  useEffect(()=>setItems(readStorage(keys.savedSearches,seedSearches)),[]);
  function persist(next){setItems(next);writeStorage(keys.savedSearches,next)}
  function remove(id){persist(items.filter((item)=>item.id!==id));notify("Saved search deleted.","info")}
  function duplicate(item){const copy={...item,id:`search-${Date.now()}`,name:`${item.name} Copy`,lastRun:"Never"};persist([copy,...items]);notify("Saved search duplicated.")}
  function run(item){notify(`Running ${item.name}...`);}
  return <><PageHeader eyebrow="Automated discovery" title="Saved Searches" description="Reusable lead criteria with recurring alert-ready monitoring." actions={<Link href="/search/new"><Button variant="primary"><Plus className="h-4 w-4"/>New saved search</Button></Link>}/><div className="grid gap-4 md:grid-cols-2">{items.map((item)=><div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><Link href={`/saved-searches/${item.id}`} className="text-sm font-black text-slate-900 hover:text-brand-600">{item.name}</Link><p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px] font-semibold text-slate-600">{item.summary}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${item.active?"border-emerald-100 bg-emerald-50 text-emerald-700":"border-slate-200 bg-slate-50 text-slate-500"}`}>{item.active?"Active":"Paused"}</span></div><div className="mt-4 grid grid-cols-3 gap-3 text-center"><div><p className="text-[10px] uppercase tracking-wide text-slate-400">New</p><p className="mt-1 text-lg font-black text-emerald-700">+{item.newMatches}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Total</p><p className="mt-1 text-lg font-black text-slate-900">{item.totalMatches}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-400">Frequency</p><p className="mt-1 text-sm font-black text-slate-800">{item.frequency}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-[10px] text-slate-400">Last run {item.lastRun}</span><div className="flex gap-1"><button onClick={()=>run(item)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Play className="h-3.5 w-3.5"/></button><button onClick={()=>duplicate(item)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Copy className="h-3.5 w-3.5"/></button><button onClick={()=>remove(item.id)} className="rounded-lg border border-rose-100 p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5"/></button></div></div></div>)}</div></>;
}
