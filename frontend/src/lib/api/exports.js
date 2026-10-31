import { api } from "./client";

export const exportsApi = {
  create: (body) => api.post("/exports", body),
  list: (query, options) => api.get("/exports", { ...options, query }),
  get: (id, options) => api.get(`/exports/${id}`, options),
  // Downloads are plain navigations so the browser streams the file with the session cookie.
  downloadUrl: (id) => `/api/v1/exports/${id}/download`
};
