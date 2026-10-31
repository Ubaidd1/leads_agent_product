import { api } from "./client";

export const analyticsApi = {
  dashboard: (query, options) => api.get("/dashboard", { ...options, query }),
  overview: (query, options) => api.get("/analytics/overview", { ...options, query }),
  leadsOverTime: (query, options) => api.get("/analytics/leads-over-time", { ...options, query }),
  technologies: (query, options) => api.get("/analytics/technologies", { ...options, query }),
  industries: (query, options) => api.get("/analytics/industries", { ...options, query }),
  seniority: (query, options) => api.get("/analytics/seniority", { ...options, query }),
  scoreDistribution: (query, options) => api.get("/analytics/score-distribution", { ...options, query }),
  recentActivity: (query, options) => api.get("/analytics/recent-activity", { ...options, query })
};
