"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import CriteriaForm, { MatchEstimate } from "@/components/leads/CriteriaForm";
import SaveSearchModal from "@/components/leads/SaveSearchModal";
import { toQuery } from "@/lib/api/client";
import { profileApi } from "@/lib/api/profile";
import { EMPTY_CRITERIA, criteriaSummary, criteriaToQuery } from "@/lib/criteria";

export default function SearchBuilderPage() {
  const router = useRouter();
  const [criteria, setCriteria] = useState(EMPTY_CRITERIA);
  const [saveOpen, setSaveOpen] = useState(false);

  // Start from the user's onboarding preferences when they have them.
  useEffect(() => {
    profileApi.getOnboarding().then(({ preferences }) => {
      if (!preferences) return;
      setCriteria((current) => ({
        ...current,
        serviceTypes: preferences.services || [],
        technologies: preferences.technologies || [],
        regions: preferences.region && preferences.region !== "worldwide" ? [preferences.region] : [],
        freshnessDays: preferences.freshnessDays ?? null
      }));
    }).catch(() => {});
  }, []);

  return (
    <>
      <PageHeader eyebrow="Advanced discovery" title="Search Builder" description="Define the service, market, remote eligibility, freshness and commercial threshold for qualified opportunities." />
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <CriteriaForm criteria={criteria} onChange={setCriteria} />
        <div className="mt-6"><MatchEstimate criteria={criteria} /></div>
        <p className="mt-3 text-[11px] text-slate-500">Summary: {criteriaSummary(criteria)}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">
          <Button onClick={() => setSaveOpen(true)}><BookmarkPlus className="h-4 w-4" />Save search</Button>
          <Button variant="primary" onClick={() => router.push(`/leads${toQuery(criteriaToQuery(criteria))}`)}><Search className="h-4 w-4" />Search leads</Button>
        </div>
      </div>
      <SaveSearchModal open={saveOpen} onClose={() => setSaveOpen(false)} criteria={criteria} defaultName={criteria.technologies.length ? `${criteria.technologies.slice(0, 2).join(" & ")} watch` : ""} onSaved={(created) => router.push(`/saved-searches/${created.id}`)} />
    </>
  );
}
