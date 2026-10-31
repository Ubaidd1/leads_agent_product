import { api } from "./client";

// Auth endpoints answer 401 for bad credentials, which must not trigger the global sign-in redirect.
const noRedirect = { redirectOn401: false };

export const authApi = {
  session: () => api.get("/auth/session", noRedirect),
  login: ({ email, password, rememberMe }) => api.post("/auth/login", { email, password, rememberMe }, noRedirect),
  register: ({ email, password, fullName, workspaceName }) => api.post("/auth/register", { email, password, fullName, workspaceName }, noRedirect),
  logout: () => api.post("/auth/logout", undefined, noRedirect),
  switchWorkspace: (workspaceId) => api.put("/auth/session/workspace", { workspaceId }),
  requestPasswordReset: (email) => api.post("/auth/password-reset/request", { email }, noRedirect),
  confirmPasswordReset: (token, newPassword) => api.post("/auth/password-reset/confirm", { token, newPassword }, noRedirect),
  acceptInvitation: ({ token, fullName, password }) => api.post("/auth/invitations/accept", { token, fullName: fullName || undefined, password: password || undefined }, noRedirect)
};
