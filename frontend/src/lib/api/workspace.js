import { api } from "./client";

export const workspaceApi = {
  get: () => api.get("/workspace"),
  update: (changes) => api.patch("/workspace", changes),
  members: () => api.get("/workspace/members"),
  changeRole: (membershipId, role) => api.patch(`/workspace/members/${membershipId}`, { role }),
  removeMember: (membershipId) => api.delete(`/workspace/members/${membershipId}`),
  invitations: () => api.get("/workspace/invitations"),
  invite: (email, role) => api.post("/workspace/invitations", { email, role }),
  revokeInvitation: (id) => api.delete(`/workspace/invitations/${id}`)
};
