"use client";

export const keys = {
  session: "hi_session",
  savedLeads: "hi_saved_leads",
  savedSearches: "hi_saved_searches",
  alerts: "hi_alerts",
  exports: "hi_exports",
  profile: "hi_profile",
  workspace: "hi_workspace",
  onboarding: "hi_onboarding",
  integrations: "hi_integrations"
};

export function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}
