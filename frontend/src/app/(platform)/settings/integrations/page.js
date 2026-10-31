import PageHeader from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/Badge";

// Planned providers (backend plan §3.6). None has a working connection flow yet, so none offers a
// Connect button. This list switches to GET /integrations when the first provider ships.
const PROVIDERS = [
  ["Webhook", "Send signed JSON events for saved leads, alerts and finished exports."],
  ["Slack", "Post high-intent alerts to a channel."],
  ["HubSpot", "Push qualified companies and deals into your CRM."],
  ["Salesforce", "Enrich accounts and create opportunities from hiring signals."],
  ["Pipedrive", "Create organizations and deals automatically."],
  ["Zapier", "Trigger downstream workflows."]
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Integrations" description="Connect hiring intelligence to your sales and notification tools." />
      <p className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">No integrations are available yet. Each provider will be enabled here once its connection flow has been built and tested.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.map(([name, description]) => (
          <div key={name} className="flex items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div><h2 className="text-sm font-black text-slate-900">{name}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div>
            <StatusPill>Coming soon</StatusPill>
          </div>
        ))}
      </div>
    </>
  );
}
