import { api } from "./client";

export const profileApi = {
  get: () => api.get("/me"),
  update: (changes) => api.patch("/me", changes),
  changePassword: (currentPassword, newPassword) => api.post("/me/password", { currentPassword, newPassword }),
  getOnboarding: () => api.get("/me/onboarding"),
  saveOnboarding: (preferences) => api.put("/me/onboarding", preferences),
  workspaces: () => api.get("/workspaces")
};
