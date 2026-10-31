"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { alertsApi } from "@/lib/api/alerts";
import { useApi } from "@/lib/useApi";
import { timeAgo } from "@/lib/format";

const POLL_MS = 60000;

/** Header bell: real unread count (dot hidden at zero) and the three latest alerts. */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const count = useApi((signal) => alertsApi.unreadCount({ signal }), [], { revalidateOnFocus: true });
  const latest = useApi(open ? (signal) => alertsApi.list({ pageSize: 3 }, { signal }) : null, [open]);

  const reloadCount = count.reload;
  useEffect(() => {
    const timer = setInterval(() => document.visibilityState === "visible" && reloadCount({ quiet: true }), POLL_MS);
    const onChange = () => reloadCount({ quiet: true });
    window.addEventListener("alerts:changed", onChange);
    return () => { clearInterval(timer); window.removeEventListener("alerts:changed", onChange); };
  }, [reloadCount]);

  const unread = count.data?.count ?? 0;
  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className="relative rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-expanded={open}>
        <Bell className="h-4 w-4" />
        {unread ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><span className="text-sm font-bold">Recent alerts{unread ? <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700">{unread} unread</span> : null}</span><Link href="/alerts" onClick={() => setOpen(false)} className="text-xs font-semibold text-brand-600">View all</Link></div>
          {latest.loading ? <p className="px-4 py-5 text-xs text-slate-400">Loading…</p> : latest.error ? <p className="px-4 py-5 text-xs text-rose-600">{latest.error.message}</p> : latest.data?.items.length ? latest.data.items.map((alert) => (
            <Link href="/alerts" key={alert.id} onClick={() => setOpen(false)} className="block border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"><p className={`text-xs leading-5 ${alert.isRead ? "font-medium text-slate-600" : "font-semibold text-slate-900"}`}>{alert.title}</p><p className="mt-1 text-[10px] text-slate-400">{timeAgo(alert.createdAt)}</p></Link>
          )) : <p className="px-4 py-5 text-xs text-slate-500">No alerts yet. Alerts appear when a saved search finds new matches.</p>}
        </div>
      ) : null}
    </div>
  );
}

/** Lets pages tell the bell to refresh after marking alerts read or dismissing them. */
export function announceAlertsChanged() {
  window.dispatchEvent(new Event("alerts:changed"));
}
