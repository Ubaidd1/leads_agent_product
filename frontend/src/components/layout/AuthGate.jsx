"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { ErrorState } from "@/components/ui/States";

/** Protects every (platform) route: restores the server session, otherwise sends the user to /login. */
export default function AuthGate({ children }) {
  const { status, refresh } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      const next = `${pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, pathname, router]);

  if (status === "authenticated") return children;
  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <ErrorState className="w-full max-w-md" title="Cannot reach the Hiring Intelligence API" error={{ message: "The server is not responding. Check that the backend is running, then try again." }} onRetry={refresh} />
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas" role="status">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading your workspace…</span>
    </div>
  );
}
