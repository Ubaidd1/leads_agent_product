"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, LogOut, Menu, Search, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { companiesApi, leadsApi } from "@/lib/api/catalog";
import { isAbortError } from "@/lib/api/client";
import { profileApi } from "@/lib/api/profile";
import { initials, titleCase } from "@/lib/format";
import NotificationBell from "@/components/layout/NotificationBell";

function useGlobalSearch(query) {
  const [results, setResults] = useState([]);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) return setResults([]);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const [companies, leads] = await Promise.all([
          companiesApi.list({ q: value, pageSize: 3 }, { signal: controller.signal }),
          leadsApi.list({ q: value, pageSize: 4 }, { signal: controller.signal })
        ]);
        setResults([
          ...companies.items.map((item) => ({ label: item.name, meta: "Company", href: `/companies/${item.slug}` })),
          ...leads.items.map((item) => ({ label: item.jobTitle, meta: item.companyName, href: `/leads/${item.id}` }))
        ]);
      } catch (error) {
        if (!isAbortError(error)) setResults([]);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return results;
}

export default function Header({ onOpenSidebar }) {
  const router = useRouter();
  const { notify } = useToast();
  const { user, workspace, logout, switchWorkspace } = useSession();
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState(null);
  const inputRef = useRef(null);
  const searchResults = useGlobalSearch(query);

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (profileOpen && workspaces === null) profileApi.workspaces().then(setWorkspaces).catch(() => setWorkspaces([]));
  }, [profileOpen, workspaces]);

  async function changeWorkspace(id) {
    if (id === workspace?.id) return;
    try {
      const next = await switchWorkspace(id);
      setProfileOpen(false);
      notify(`Switched to ${next.workspace.name}.`);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      notify(error.message, "error");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button onClick={onOpenSidebar} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label="Open navigation"><Menu className="h-4 w-4" /></button>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim()) { router.push(`/leads?q=${encodeURIComponent(query.trim())}`); setQuery(""); } if (event.key === "Escape") setQuery(""); }} placeholder="Search companies, leads, technologies..." aria-label="Search" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-12 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/10" />
          <span className="absolute right-2 top-2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">⌘K</span>
          {searchResults.length ? (
            <div className="absolute left-0 right-0 top-11 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
              {searchResults.map((result) => <Link key={`${result.href}-${result.label}`} href={result.href} onClick={() => setQuery("")} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 last:border-0 hover:bg-slate-50"><span className="truncate text-sm font-semibold text-slate-800">{result.label}</span><span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{result.meta}</span></Link>)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {workspace?.isDemo ? <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 md:inline-flex">Demo data</span> : null}
        <NotificationBell />
        <div className="relative">
          <button onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 hover:bg-slate-50" aria-expanded={profileOpen} aria-label="Account menu"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-[10px] font-black text-white">{initials(user?.fullName)}</span><span className="hidden text-xs font-bold text-slate-700 md:block">{user?.fullName}</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></button>
          {profileOpen ? (
            <div className="absolute right-0 top-11 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-soft">
              <div className="border-b border-slate-100 px-3 pb-2 pt-1.5"><p className="truncate text-xs font-bold text-slate-900">{user?.fullName}</p><p className="truncate text-[11px] text-slate-500">{user?.email}</p></div>
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Workspaces</p>
              {(workspaces || [workspace]).filter(Boolean).map((item) => <button key={item.id} onClick={() => changeWorkspace(item.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><span className="min-w-0"><span className="block truncate font-semibold">{item.name}</span><span className="block text-[10px] text-slate-400">{titleCase(item.role)}{item.isDemo ? " · Demo" : ""}</span></span>{item.id === workspace?.id ? <Check className="h-4 w-4 shrink-0 text-brand-600" /> : null}</button>)}
              <div className="my-1 border-t border-slate-100" />
              <Link href="/settings/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><UserRound className="h-4 w-4 text-slate-400" />Profile</Link>
              <Link href="/settings/workspace" onClick={() => setProfileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Workspace settings</Link>
              <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" />Sign out</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
