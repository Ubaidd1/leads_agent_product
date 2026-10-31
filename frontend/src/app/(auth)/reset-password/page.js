"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import AuthCard, { FormError, inputClass } from "@/components/layout/AuthCard";
import { authApi } from "@/lib/api/auth";
import { useToast } from "@/components/providers/ToastProvider";

function ResetPasswordForm() {
  const router = useRouter();
  const { notify } = useToast();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(token ? "" : "This reset link is missing its token. Request a new link.");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) return setError("The passwords do not match.");
    setError("");
    setSubmitting(true);
    try {
      await authApi.confirmPasswordReset(token, password);
      notify("Password updated. Sign in with your new password.");
      router.replace("/login");
    } catch (err) {
      setError(err.fieldErrors.newPassword || err.message);
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Choose a new password" description="Use at least 10 characters. Signing in again is required on every device." footer={<Link href="/forgot-password" className="font-bold text-brand-600">Request a new link</Link>}>
      <form onSubmit={submit}>
        <FormError message={error} />
        <label className="block text-xs font-bold text-slate-700">New password<input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label>
        <label className="mt-4 block text-xs font-bold text-slate-700">Confirm password<input type="password" required minLength={10} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className={inputClass} /></label>
        <Button variant="primary" disabled={submitting || !token} className="mt-5 w-full">{submitting ? "Saving…" : "Update password"}</Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={null}><ResetPasswordForm /></Suspense>;
}
