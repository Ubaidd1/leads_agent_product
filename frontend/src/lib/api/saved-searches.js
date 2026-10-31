import { api } from "./client";

export const savedSearchesApi = {
  list: (query, options) => api.get("/saved-searches", { ...options, query }),
  get: (id, options) => api.get(`/saved-searches/${id}`, options),
  create: (body) => api.post("/saved-searches", body),
  update: (id, changes) => api.patch(`/saved-searches/${id}`, changes),
  remove: (id) => api.delete(`/saved-searches/${id}`),
  duplicate: (id) => api.post(`/saved-searches/${id}/duplicate`),
  run: (id) => api.post(`/saved-searches/${id}/run`),
  runs: (id, query, options) => api.get(`/saved-searches/${id}/runs`, { ...options, query }),
  results: (id, query, options) => api.get(`/saved-searches/${id}/results`, { ...options, query }),
  count: (query, options) => api.get("/leads/count", { ...options, query })
};
