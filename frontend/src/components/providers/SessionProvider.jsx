"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setCsrfToken, setUnauthenticatedHandler } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";

const SessionContext = createContext(null);

/**
 * Holds the server session (user, active workspace, permissions). The session cookie is HttpOnly;
 * only the CSRF token is kept, in memory. On mount it restores the session with GET /auth/session.
 */
export function SessionProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSessionState] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | unauthenticated
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const setSession = useCallback((next) => {
    setCsrfToken(next?.csrfToken);
    setSessionState(next);
    setStatus(next ? "authenticated" : "unauthenticated");
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSession(await authApi.session());
    } catch (error) {
      if (error.status === 401) setSession(null);
      else {
        // Server unreachable: do not pretend the user is signed out, surface the error instead.
        setStatus("error");
      }
    }
  }, [setSession]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setSession(null);
      const current = pathRef.current || "/dashboard";
      router.replace(`/login?next=${encodeURIComponent(current)}&expired=1`);
    });
    return () => setUnauthenticatedHandler(null);
  }, [router, setSession]);

  const value = useMemo(() => ({
    session,
    status,
    user: session?.user ?? null,
    workspace: session?.workspace ?? null,
    permissions: session?.permissions ?? [],
    can: (permission) => Boolean(session?.permissions?.includes(permission)),
    setSession,
    refresh,
    async login(credentials) {
      const next = await authApi.login(credentials);
      setSession(next);
      return next;
    },
    async register(details) {
      const next = await authApi.register(details);
      setSession(next);
      return next;
    },
    async logout() {
      try {
        await authApi.logout();
      } finally {
        setSession(null);
        router.replace("/login");
      }
    },
    async switchWorkspace(workspaceId) {
      const next = await authApi.switchWorkspace(workspaceId);
      setSession(next);
      return next;
    }
  }), [session, status, setSession, refresh, router]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

/** Only allow same-site relative paths as post-login destinations (prevents open redirects). */
export function safeNext(next, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
