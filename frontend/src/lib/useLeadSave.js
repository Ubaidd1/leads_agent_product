"use client";

import { useCallback, useState } from "react";
import { leadsApi } from "@/lib/api/catalog";
import { useToast } from "@/components/providers/ToastProvider";

/**
 * Save/unsave with an optimistic update that is rolled back if the API call fails.
 * `apply(leadId, isSaved)` must update the caller's local copy of the lead(s).
 */
export function useLeadSave(apply) {
  const { notify } = useToast();
  const [pending, setPending] = useState(() => new Set());

  const toggle = useCallback(async (lead) => {
    const next = !lead.isSaved;
    setPending((ids) => new Set(ids).add(lead.id));
    apply(lead.id, next);
    try {
      if (next) await leadsApi.save(lead.id);
      else await leadsApi.unsave(lead.id);
      notify(next ? `Saved ${lead.companyName} · ${lead.jobTitle}.` : "Removed from saved leads.", next ? "success" : "info");
    } catch (error) {
      apply(lead.id, !next);
      notify(error.message, "error");
    } finally {
      setPending((ids) => {
        const copy = new Set(ids);
        copy.delete(lead.id);
        return copy;
      });
    }
  }, [apply, notify]);

  return { toggle, pending };
}
