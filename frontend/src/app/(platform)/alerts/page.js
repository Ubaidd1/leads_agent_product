"use client";

import { useEffect, useState } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import { alerts as seedAlerts } from "@/data/alerts";
import { keys, readStorage, writeStorage } from "@/lib/storage";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

export default function AlertsPage(){const [items,setItems]=useState([]);useEffect(()=>setItems(readStorage(keys.alerts,seedAlerts)),[]);function save(next){setItems(next);writeStorage(keys.alerts,next)}return <><PageHeader eyebrow="Signal monitoring" title="Alerts" description="Notifications from saved searches and meaningful changes in company hiring behavior." actions={<Button onClick={()=>save(items.map((item)=>({...item,unread:false})))}><CheckCheck className="h-4 w-4"/>Mark all read</Button>}/><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{items.map((item)=><div key={item.id} className={`flex items-center justify-between gap-4 border-b border-slate-100 p-4 last:border-0 ${item.unread?"bg-brand-50/30":"bg-white"}`}><div className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 rounded-full ${item.unread?"bg-brand-600":"bg-slate-300"}`}/><div><p className="text-sm font-bold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail} · {item.channel} · {item.time}</p></div></div><div className="flex items-center gap-2"><button onClick={()=>save(items.map((alert)=>alert.id===item.id?{...alert,status:alert.status==="Active"?"Paused":"Active"}:alert))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50">{item.status}</button><button onClick={()=>save(items.filter((alert)=>alert.id!==item.id))} className="rounded-lg border border-rose-100 p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5"/></button></div></div>)}</div></>}
