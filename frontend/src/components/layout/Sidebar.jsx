"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BellRing, BookmarkCheck, BriefcaseBusiness, Building2, FileDown, LayoutDashboard, Settings, X } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { initials, titleCase } from "@/lib/format";

const navigation = [
  ["Overview", "/dashboard", LayoutDashboard],
  ["Lead Discovery", "/leads", BriefcaseBusiness],
  ["Companies", "/companies", Building2],
  ["Saved Searches", "/saved-searches", BookmarkCheck],
  ["Alerts", "/alerts", BellRing],
  ["Exports", "/exports", FileDown],
  ["Analytics", "/analytics", BarChart3],
  ["Settings", "/settings", Settings]
];

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { user, workspace } = useSession();
  return (
    <>
      {open ? <button aria-label="Close menu" onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950 text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-xs font-black shadow-lg shadow-brand-900/20">HI</span>
            <span>
              <span className="block text-sm font-bold">Hiring Intelligence</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Commercial Signals</span>
            </span>
          </Link>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-900 lg:hidden" aria-label="Close sidebar"><X className="h-5 w-5" /></button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {navigation.map(([label, href, Icon]) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} onClick={onClose} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"}`}>
                <Icon className={`h-4 w-4 ${active ? "text-brand-100" : "text-slate-500"}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <Link href="/settings/workspace" onClick={onClose} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-xs font-black">{initials(workspace?.name)}</span>
            <span className="min-w-0"><span className="block truncate text-xs font-bold">{workspace?.name}</span><span className="block truncate text-[10px] text-slate-500">{user?.email} · {titleCase(workspace?.role)}</span></span>
          </Link>
        </div>
      </aside>
    </>
  );
}
