// Vocabularies shared with the backend's request validation (app/schemas/constants.py).
// Values are what the API accepts; labels are for display only.

export const REGIONS = [
  ["worldwide", "Worldwide"],
  ["united-states", "United States"],
  ["canada", "Canada"],
  ["latam", "LatAm"],
  ["europe", "Europe"],
  ["united-kingdom", "United Kingdom"],
  ["pakistan-allowed", "Pakistan Allowed"],
  ["international-remote", "International Remote"]
];

export const FRESHNESS = [
  [1, "24 hours"],
  [3, "3 days"],
  [7, "7 days"],
  [14, "14 days"],
  [30, "30 days"]
];

export const INTENTS = [
  ["strong", "Strong"],
  ["medium", "Medium"],
  ["low", "Low"]
];

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "PKR"];

// Service types and technologies are free text on the backend (max 100 chars); these are the
// options the UI offers, matching the values used by the catalogue and onboarding.
export const SERVICE_TYPES = ["Software Development", "AI / ML", "Web Development", "Mobile Development", "SEO", "PPC", "Content", "Recruiting"];
export const TECHNOLOGIES = ["React", "Next.js", "Node.js", "Python", "Django", "FastAPI", "AWS", "Azure", "GCP", "LLM", "RAG", "Machine Learning", "PostgreSQL", "Kubernetes", "Go", "SEO"];

export const LEAD_SORTS = [
  ["score", "Lead score"],
  ["postedAt", "Most recent"],
  ["lastVerifiedAt", "Recently verified"],
  ["companyName", "Company name"]
];

export const COMPANY_SORTS = [
  ["intentScore", "Intent score"],
  ["hiringVelocity", "Hiring velocity"],
  ["openRoles", "Open roles"],
  ["name", "Name"]
];

export const PAGE_SIZES = [25, 50, 100];

export const ROLES = ["member", "admin", "owner"];

export const TIMEZONES = ["UTC", "Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney"];

export function regionLabel(value) {
  return REGIONS.find(([key]) => key === value)?.[1] || value;
}

export function freshnessLabel(days) {
  return FRESHNESS.find(([key]) => key === Number(days))?.[1] || `${days} days`;
}
