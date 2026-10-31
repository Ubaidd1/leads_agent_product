import PageHeader from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/Badge";

// Source types the ingestion pipeline will support, in the order they will be built (backend plan §3.4).
// Nothing here is connected yet; this page switches to the source registry API when it ships.
const SOURCE_TYPES = [
  ["Manual CSV import", "Customer-supplied files", "Your workspace owns the data"],
  ["Greenhouse / Lever / Ashby job boards", "Public ATS job-board APIs", "Provider terms recorded per source"],
  ["Licensed partner feeds", "Licensed feed", "Signed agreement required"],
  ["Company career pages", "schema.org JobPosting / structured feeds", "robots.txt respected; no login or CAPTCHA bypass"]
];

export default function DataSourcesPage() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Data Sources" description="Source permissions, ingestion type, sync health and compliance status." />
      <p className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">No data sources are connected yet. A source can only be enabled once its permission or licence has been recorded. Until then, leads come from the shared catalogue and any demo data in your workspace.</p>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Source</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Permission basis</th><th className="px-4 py-3">Last sync</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody>{SOURCE_TYPES.map(([name, type, basis]) => <tr key={name} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 text-xs font-bold text-slate-900">{name}</td><td className="px-4 py-3 text-xs text-slate-600">{type}</td><td className="px-4 py-3 text-xs text-slate-600">{basis}</td><td className="px-4 py-3 text-xs text-slate-400">Never</td><td className="px-4 py-3"><StatusPill>Not configured</StatusPill></td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
