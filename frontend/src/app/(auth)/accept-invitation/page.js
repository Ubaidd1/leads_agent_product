"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import AuthCard, { FormError, inputClass } from "@/components/layout/AuthCard";
import { authApi } from "@/lib/api/auth";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";

function AcceptInvitationForm() {
  const router = useRouter();
  const { notify } = useToast();
  const { status, refresh, switchWorkspace } = useSession();
  const token = useSearchParams().get("token") || "";
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(token ? "" : "This invitation link is missing its token.");
  const [submitting, setSubmitting] = useState(false);
  const signedIn = status === "authenticated";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await authApi.acceptInvitation({ token, fullName: signedIn ? undefined : fullName, password: signedIn ? undefined : password });
      if (result.signedIn) await refresh();
      if (signedIn || result.signedIn) {
        await switchWorkspace(result.workspaceId);
        notify("Invitation accepted.");
        router.replace("/dashboard");
      } else {
        // Existing account that is not signed in here: the membership exists, now sign in.
        notify("Invitation accepted. Sign in to open the workspace.");
        router.replace("/login");
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Join your team's workspace"
      description={signedIn ? "Accept the invitation to add this workspace to your account." : "New here? Choose your name and a password. Already have an account? Sign in first, then open the link again."}
      footer={signedIn ? null : <Link href={`/login?next=${encodeURIComponent(`/accept-invitation?token=${token}`)}`} className="font-bold text-brand-600">I already have an account</Link>}
    >
      <form onSubmit={submit}>
        <FormError message={error} />
        {signedIn ? null : (
          <>
            <label className="block text-xs font-bold text-slate-700">Full name<input required maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} /></label>
            <label className="mt-4 block text-xs font-bold text-slate-700">Password<input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label>
          </>
        )}
        <Button variant="primary" disabled={submitting || !token || status === "loading"} className="mt-5 w-full">{submitting ? "Joining…" : "Accept invitation"}</Button>
      </form>
    </AuthCard>
  );
}

export default function AcceptInvitationPage() {
  return <Suspense fallback={null}><AcceptInvitationForm /></Suspense>;
}
