import { api } from "./client";

export const leadsApi = {
  list: (query, options) => api.get("/leads", { ...options, query }),
  get: (id, options) => api.get(`/leads/${encodeURIComponent(id)}`, options),
  save: (id) => api.put(`/leads/${encodeURIComponent(id)}/save`),
  unsave: (id) => api.delete(`/leads/${encodeURIComponent(id)}/save`),
  saved: (query, options) => api.get("/saved-leads", { ...options, query })
};

export const companiesApi = {
  list: (query, options) => api.get("/companies", { ...options, query }),
  get: (idOrSlug, options) => api.get(`/companies/${encodeURIComponent(idOrSlug)}`, options)
};
