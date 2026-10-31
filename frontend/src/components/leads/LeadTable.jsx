"use client";

import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { IntentBadge, ScoreBadge, Tag } from "@/components/ui/Badge";
import { formatSalary, timeAgo } from "@/lib/format";

export function rolesLabel(lead) {
  if (lead.relevantOpenRoles == null && lead.openRolesTotal == null) return "—";
  return `${lead.relevantOpenRoles ?? "?"}/${lead.openRolesTotal ?? "?"}`;
}

export function SaveButton({ lead, pending, onSave, className = "" }) {
  const Icon = pending ? Loader2 : lead.isSaved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={(event) => { event.stopPropagation(); event.preventDefault(); onSave?.(lead); }}
      aria-pressed={lead.isSaved}
      aria-label={lead.isSaved ? `Unsave ${lead.jobTitle}` : `Save ${lead.jobTitle}`}
      className={`rounded-lg border p-2 transition disabled:opacity-60 ${lead.isSaved ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
    </button>
  );
}

export default function LeadTable({ leads, onSave, pendingIds, showSave = true, newIds }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1100px] w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
            <th className="px-4 py-3">Company & opportunity</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Intent</th>
            <th className="px-4 py-3" title="Relevant open roles / all open roles at the company">Roles</th>
            <th className="px-4 py-3">Technologies</th>
            <th className="px-4 py-3">Remote fit</th>
            <th className="px-4 py-3">Salary</th>
            <th className="px-4 py-3">Freshness</th>
            {showSave ? <th className="px-4 py-3 text-right">Save</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="cursor-pointer transition hover:bg-brand-50/40">
              <td className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-100 text-[11px] font-black text-slate-700">{lead.companyLogo}</span>
                  <span className="min-w-0"><span className="block max-w-[250px] truncate text-xs font-bold text-slate-900">{lead.jobTitle}{newIds?.has(lead.id) ? <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700">New</span> : null}</span><span className="mt-1 block text-[11px] text-slate-500">{lead.companyName}</span></span>
                </div>
              </td>
              <td className="px-4 py-3"><ScoreBadge score={lead.leadScore} /></td>
              <td className="px-4 py-3"><IntentBadge intent={lead.hiringIntent} /></td>
              <td className="px-4 py-3 text-xs font-bold text-slate-700">{rolesLabel(lead)}</td>
              <td className="px-4 py-3"><div className="flex max-w-[210px] flex-wrap gap-1">{lead.technologies.slice(0, 3).map((tech) => <Tag key={tech}>{tech}</Tag>)}</div></td>
              <td className="max-w-[180px] px-4 py-3 text-[11px] leading-5 text-slate-600">{lead.remoteFit || "Not stated"}</td>
              <td className="px-4 py-3 text-xs font-bold text-slate-800">{formatSalary(lead.salaryMin, lead.salaryMax, lead.salaryCurrency)}</td>
              <td className="px-4 py-3"><span className="block text-xs font-semibold text-slate-700">{lead.postedAt ? `Posted ${timeAgo(lead.postedAt)}` : "Post date unknown"}</span><span className={`mt-1 block text-[10px] ${lead.lastVerifiedAt ? "text-emerald-700" : "text-slate-400"}`}>{lead.lastVerifiedAt ? `Verified ${timeAgo(lead.lastVerifiedAt)}` : "Not verified"}</span></td>
              {showSave ? <td className="px-4 py-3 text-right"><SaveButton lead={lead} pending={pendingIds?.has(lead.id)} onSave={onSave} /></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
