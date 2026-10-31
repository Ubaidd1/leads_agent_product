"use client";

import Link from "next/link";
import { useState } from "react";
import { BellOff, CheckCheck, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { StatusPill } from "@/components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/providers/ToastProvider";
import { announceAlertsChanged } from "@/components/layout/NotificationBell";
import { alertsApi } from "@/lib/api/alerts";
import { useApi } from "@/lib/useApi";
import { timeAgo } from "@/lib/format";

const CHANNEL_LABELS = { in_app: "In-app", email: "Email", slack: "Slack", webhook: "Webhook" };
const STATUS_TONES = { sent: "emerald", pending: "amber", failed: "rose", skipped: "slate" };

function channelText(channel) {
  const label = CHANNEL_LABELS[channel.channel] || channel.channel;
  if (channel.status === "sent") return `${label}: delivered`;
  if (channel.status === "skipped") return `${label}: not sent${channel.errorCode === "EMAIL_NOT_CONFIGURED" ? " (no email provider)" : ""}`;
  if (channel.status === "failed") return `${label}: failed${channel.errorMessage ? ` (${channel.errorMessage})` : ""}`;
  return `${label}: pending`;
}

export default function AlertsPage() {
  const { notify } = useToast();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const alerts = useApi((signal) => alertsApi.list({ page, pageSize: 25, unread: filter === "unread" ? true : undefined }, { signal }), [page, filter], { keepPrevious: true, revalidateOnFocus: true });
  const data = alerts.data;

  /** Optimistic update with rollback on failure. */
  async function optimistic(change, request, success) {
    const before = alerts.data;
    alerts.setData(change);
    try {
      await request();
      if (success) notify(success, "info");
      announceAlertsChanged();
    } catch (error) {
      alerts.setData(before);
      notify(error.message, "error");
    }
  }

  const patchItem = (id, fields) => (current) => current && { ...current, items: current.items.map((item) => (item.id === id ? { ...item, ...fields } : item)) };
  const setRead = (item, read) => optimistic(patchItem(item.id, { isRead: read }), () => alertsApi.update(item.id, { read }));
  const setPaused = (item) => optimistic(
    (current) => current && { ...current, items: current.items.map((other) => (other.savedSearchId && other.savedSearchId === item.savedSearchId ? { ...other, isPaused: !item.isPaused } : other)) },
    () => alertsApi.update(item.id, { paused: !item.isPaused }),
    item.isPaused ? `Alerts resumed for “${item.savedSearchName}”.` : `Alerts paused for “${item.savedSearchName}”.`
  );
  const dismiss = (item) => optimistic((current) => current && { ...current, total: current.total - 1, items: current.items.filter((other) => other.id !== item.id) }, () => alertsApi.dismiss(item.id), "Alert removed.");
  async function markAll() {
    try {
      const { updated } = await alertsApi.markAllRead();
      alerts.setData((current) => current && { ...current, items: current.items.map((item) => ({ ...item, isRead: true })) });
      notify(updated ? `Marked ${updated} alert${updated === 1 ? "" : "s"} as read.` : "Everything was already read.", "info");
      announceAlertsChanged();
      if (filter === "unread") alerts.reload({ quiet: true });
    } catch (error) {
      notify(error.message, "error");
    }
  }

  return (
    <>
      <PageHeader eyebrow="Signal monitoring" title="Alerts" description="Notifications from saved searches and meaningful changes in company hiring behavior." actions={<><div className="flex rounded-lg border border-slate-200 bg-white p-1">{[["all", "All"], ["unread", "Unread"]].map(([key, label]) => <button key={key} onClick={() => { setFilter(key); setPage(1); }} aria-pressed={filter === key} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${filter === key ? "bg-brand-600 text-white" : "text-slate-500"}`}>{label}</button>)}</div><Button onClick={markAll}><CheckCheck className="h-4 w-4" />Mark all read</Button></>} />
      {alerts.error ? <ErrorState error={alerts.error} onRetry={alerts.reload} title="Could not load alerts" />
        : !data ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><SkeletonRows rows={5} /></div>
        : data.items.length === 0 ? <EmptyState icon={BellOff} title={filter === "unread" ? "No unread alerts" : "No alerts yet"} description="Alerts appear when a saved search finds new matching leads." action={<Link href="/saved-searches"><Button>View saved searches</Button></Link>} />
        : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {data.items.map((item) => (
              <div key={item.id} className={`flex flex-col justify-between gap-3 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-center ${item.isRead ? "bg-white" : "bg-brand-50/30"}`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => setRead(item, !item.isRead)} className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? "bg-slate-300" : "bg-brand-600"}`} aria-label={item.isRead ? "Mark as unread" : "Mark as read"} title={item.isRead ? "Mark as unread" : "Mark as read"} />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.savedSearchId ? <Link href={`/saved-searches/${item.savedSearchId}`} onClick={() => !item.isRead && setRead(item, true)} className="hover:text-brand-600">{item.title}</Link> : item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{[item.detail, timeAgo(item.createdAt)].filter(Boolean).join(" · ")}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{item.channels.map((channel) => <StatusPill key={channel.channel} tone={STATUS_TONES[channel.status]}>{channelText(channel)}</StatusPill>)}{item.isDemo ? <StatusPill tone="amber">Demo</StatusPill> : null}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:shrink-0">
                  {item.canPause ? <button onClick={() => setPaused(item)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50" title="Pauses or resumes alerts from this saved search">{item.isPaused ? "Paused · Resume" : "Active · Pause"}</button> : null}
                  <button onClick={() => dismiss(item)} className="rounded-lg border border-rose-100 p-2 text-rose-500 hover:bg-rose-50" aria-label="Remove alert"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} totalPages={data.totalPages} onPage={setPage} noun="alerts" />
          </div>
        )}
    </>
  );
}
