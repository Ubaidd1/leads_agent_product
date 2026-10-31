"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, HelpCircle, LogOut, Menu, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { alerts } from "@/data/alerts";
import { companies } from "@/data/companies";
import { leads } from "@/data/leads";
import { keys, writeStorage } from "@/lib/storage";

export default function Header({ onOpenSidebar }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchResults = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (value.length < 2) return [];
    const companyMatches = companies.filter((item) => item.name.toLowerCase().includes(value)).slice(0, 3).map((item) => ({ label: item.name, meta: "Company", href: `/companies/${item.id}` }));
    const leadMatches = leads.filter((item) => `${item.companyName} ${item.jobTitle} ${item.technologies.join(" ")}`.toLowerCase().includes(value)).slice(0, 4).map((item) => ({ label: item.jobTitle, meta: item.companyName, href: `/leads/${item.id}` }));
    return [...companyMatches, ...leadMatches].slice(0, 6);
  }, [query]);

  function signOut() {
    writeStorage(keys.session, null);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button onClick={onOpenSidebar} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Open navigation"><Menu className="h-4 w-4" /></button>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim()) router.push(`/leads?search=${encodeURIComponent(query.trim())}`); }} placeholder="Search companies, leads, technologies..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-12 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/10" />
          <span className="absolute right-2 top-2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">⌘K</span>
          {searchResults.length ? (
            <div className="absolute left-0 right-0 top-11 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
              {searchResults.map((result) => <Link key={`${result.href}-${result.label}`} href={result.href} onClick={() => setQuery("")} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0 hover:bg-slate-50"><span className="truncate text-sm font-semibold text-slate-800">{result.label}</span><span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{result.meta}</span></Link>)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 md:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />Updated 4 min ago</div>
        <button className="hidden rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 sm:block" aria-label="Help"><HelpCircle className="h-4 w-4" /></button>
        <div className="relative">
          <button onClick={() => { setNotificationsOpen((value) => !value); setProfileOpen(false); }} className="relative rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Notifications"><Bell className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" /></button>
          {notificationsOpen ? <div className="absolute right-0 top-11 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><span className="text-sm font-bold">Recent alerts</span><Link href="/alerts" onClick={() => setNotificationsOpen(false)} className="text-xs font-semibold text-brand-600">View all</Link></div>{alerts.slice(0,3).map((alert) => <Link href="/alerts" key={alert.id} onClick={() => setNotificationsOpen(false)} className="block border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"><p className="text-xs font-semibold leading-5 text-slate-800">{alert.title}</p><p className="mt-1 text-[10px] text-slate-400">{alert.time}</p></Link>)}</div> : null}
        </div>
        <div className="relative">
          <button onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); }} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 hover:bg-slate-50"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-[10px] font-black text-white">ZD</span><span className="hidden text-xs font-bold text-slate-700 md:block">ZoneX Dev</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></button>
          {profileOpen ? <div className="absolute right-0 top-11 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-soft"><Link href="/settings/profile" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><UserRound className="h-4 w-4 text-slate-400" />Profile</Link><Link href="/settings/workspace" className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Workspace</Link><Link href="/settings" className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Billing & settings</Link><button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" />Sign out</button></div> : null}
        </div>
      </div>
    </header>
  );
}
