import { Suspense } from "react";
import LeadsPageClient from "./LeadsPageClient";

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading leads...</div>}>
      <LeadsPageClient />
    </Suspense>
  );
}