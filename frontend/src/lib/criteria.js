// One representation of lead filters, converted to/from the URL, GET /leads query params and the
// saved-search `criteria` object (backend SearchCriteria). Keep these in step with the backend.
import { freshnessLabel, regionLabel } from "@/lib/constants";
import { titleCase } from "@/lib/format";

export const EMPTY_CRITERIA = {
  q: "",
  serviceTypes: [],
  technologies: [],
  technologyMatch: "any",
  intents: [],
  regions: [],
  freshnessDays: null,
  minScore: null
};

function intOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

/** URLSearchParams (from the page URL) -> criteria. `?search=` is accepted for old links. */
export function criteriaFromParams(params) {
  return {
    q: params.get("q") || params.get("search") || "",
    serviceTypes: params.getAll("serviceType"),
    technologies: params.getAll("technology"),
    technologyMatch: params.get("technologyMatch") === "all" ? "all" : "any",
    intents: params.getAll("intent"),
    regions: params.getAll("region"),
    freshnessDays: intOrNull(params.get("freshnessDays")),
    minScore: intOrNull(params.get("minScore"))
  };
}

/** criteria -> query params understood by GET /leads (and by the page URL). */
export function criteriaToQuery(criteria) {
  return {
    q: criteria.q?.trim() || undefined,
    serviceType: criteria.serviceTypes,
    technology: criteria.technologies,
    technologyMatch: criteria.technologies?.length > 1 && criteria.technologyMatch === "all" ? "all" : undefined,
    intent: criteria.intents,
    region: criteria.regions,
    freshnessDays: criteria.freshnessDays ?? undefined,
    minScore: criteria.minScore ?? undefined
  };
}

/** criteria -> body for POST/PATCH /saved-searches (drops empty values). */
export function criteriaToSaved(criteria) {
  const out = {};
  if (criteria.q?.trim()) out.q = criteria.q.trim();
  for (const key of ["serviceTypes", "technologies", "intents", "regions"]) if (criteria[key]?.length) out[key] = criteria[key];
  if (criteria.technologies?.length > 1 && criteria.technologyMatch === "all") out.technologyMatch = "all";
  if (criteria.freshnessDays != null) out.freshnessDays = criteria.freshnessDays;
  if (criteria.minScore != null) out.minScore = criteria.minScore;
  return out;
}

/** Saved criteria from the API -> criteria with every key present. */
export function criteriaFromSaved(saved = {}) {
  return { ...EMPTY_CRITERIA, ...saved, q: saved.q || "" };
}

export function hasFilters(criteria) {
  return Object.keys(criteriaToSaved(criteria)).length > 0;
}

/** "React · Node.js · United States · Score 80+" — built for display, never stored. */
export function criteriaSummary(criteria) {
  const parts = [];
  if (criteria.q) parts.push(`“${criteria.q}”`);
  parts.push(...(criteria.serviceTypes || []));
  if (criteria.technologies?.length) parts.push(criteria.technologies.join(criteria.technologyMatch === "all" ? " + " : " · "));
  parts.push(...(criteria.intents || []).map((intent) => `${titleCase(intent)} intent`));
  parts.push(...(criteria.regions || []).map(regionLabel));
  if (criteria.freshnessDays) parts.push(`Last ${freshnessLabel(criteria.freshnessDays)}`);
  if (criteria.minScore != null) parts.push(`Score ${criteria.minScore}+`);
  return parts.length ? parts.join(" · ") : "All open leads";
}

/** "12 matching, 3 new" for a saved-search run, or its safe error message. */
export function runSummary(run) {
  if (!run) return null;
  if (run.status === "failed") return run.errorMessage || "The run failed.";
  return `${run.resultCount} matching, ${run.newCount} new${run.truncated ? " (capped at 10,000)" : ""}`;
}
