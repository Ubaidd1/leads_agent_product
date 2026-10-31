"use client";

// UI preferences only (e.g. table vs card view). Business data and sessions live on the server.
export const keys = {
  leadsView: "hi_pref_leads_view"
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
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota); preferences are optional.
  }
}
