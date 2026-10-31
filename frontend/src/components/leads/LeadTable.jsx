"use client";

import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { IntentBadge, ScoreBadge, Tag } from "@/components/ui/Badge";

export default function LeadTable({ leads, onSave }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1100px] w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
            <th className="px-4 py-3">Company & opportunity</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Intent</th>
            <th className="px-4 py-3">Roles</th>
            <th className="px-4 py-3">Technologies</th>
            <th className="px-4 py-3">Remote fit</th>
            <th className="px-4 py-3">Salary</th>
            <th className="px-4 py-3">Freshness</th>
            <th className="px-4 py-3 text-right">Save</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="cursor-pointer transition hover:bg-brand-50/40">
              <td className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-100 text-[11px] font-black text-slate-700">{lead.companyLogo}</span>
                  <span className="min-w-0"><span className="block max-w-[250px] truncate text-xs font-bold text-slate-900">{lead.jobTitle}</span><span className="mt-1 block text-[11px] text-slate-500">{lead.companyName}</span></span>
                </div>
              </td>
              <td className="px-4 py-3"><ScoreBadge score={lead.leadScore} /></td>
              <td className="px-4 py-3"><IntentBadge intent={lead.hiringIntent} /></td>
              <td className="px-4 py-3 text-xs font-bold text-slate-700">{lead.relevantOpenRoles}/{lead.openRolesTotal}</td>
              <td className="px-4 py-3"><div className="flex max-w-[210px] flex-wrap gap-1">{lead.technologies.slice(0,3).map((tech) => <Tag key={tech}>{tech}</Tag>)}</div></td>
              <td className="max-w-[180px] px-4 py-3 text-[11px] leading-5 text-slate-600">{lead.remoteFit}</td>
              <td className="px-4 py-3 text-xs font-bold text-slate-800">{lead.salaryRange}</td>
              <td className="px-4 py-3"><span className="block text-xs font-semibold text-slate-700">{lead.freshness}</span><span className="mt-1 block text-[10px] text-emerald-700">Verified {lead.lastVerified}</span></td>
              <td className="px-4 py-3 text-right"><button onClick={(event) => { event.stopPropagation(); onSave?.(lead); }} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700" aria-label={`Save ${lead.jobTitle}`}><Bookmark className="h-3.5 w-3.5" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
