import { api } from "./client";

export const alertsApi = {
  list: (query, options) => api.get("/alerts", { ...options, query }),
  unreadCount: (options) => api.get("/alerts/unread-count", options),
  update: (id, changes) => api.patch(`/alerts/${id}`, changes),
  markAllRead: () => api.post("/alerts/mark-all-read"),
  dismiss: (id) => api.delete(`/alerts/${id}`)
};
