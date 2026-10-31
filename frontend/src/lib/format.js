// Display helpers for API values (lowercase enums, ISO-8601 UTC timestamps, numeric salaries).

export function titleCase(value) {
  if (!value) return "";
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function initials(name) {
  if (!name) return "?";
  const words = name.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word[0] || ""));
  return (words.slice(0, 2).map((word) => word[0]).join("") || name.slice(0, 2)).toUpperCase();
}

const UNITS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60]
];
const relative = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;

/** "3 days ago", "in 2 hours", "just now". Returns `fallback` for missing values. */
export function timeAgo(iso, fallback = "—") {
  if (!iso) return fallback;
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  if (Number.isNaN(seconds)) return fallback;
  if (Math.abs(seconds) < 60) return "just now";
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatDate(iso, fallback = "—") {
  if (!iso) return fallback;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso, fallback = "—") {
  if (!iso) return fallback;
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const SYMBOLS = { USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", PKR: "Rs " };

function compact(amount) {
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return String(amount);
}

/** "$110k–$145k", "From $90k", "Up to €80k", or "Not disclosed" when the source gave no salary. */
export function formatSalary(min, max, currency) {
  if (min == null && max == null) return "Not disclosed";
  const symbol = SYMBOLS[currency] ?? (currency ? `${currency} ` : "");
  if (min != null && max != null) return min === max ? `${symbol}${compact(min)}` : `${symbol}${compact(min)}–${symbol}${compact(max)}`;
  if (min != null) return `From ${symbol}${compact(min)}`;
  return `Up to ${symbol}${compact(max)}`;
}

export function formatNumber(value, fallback = "—") {
  if (value == null) return fallback;
  return Number(value).toLocaleString();
}

/** Signed change: "+14.2%", "-3%", or null when there is no comparable previous value. */
export function formatChange(value, { suffix = "%", digits = 1 } = {}) {
  if (value == null) return null;
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${rounded}${suffix}`;
}

export function percent(value, digits = 0) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}
