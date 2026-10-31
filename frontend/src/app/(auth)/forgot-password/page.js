"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import AuthCard, { FormError, FormNotice, inputClass } from "@/components/layout/AuthCard";
import { authApi } from "@/lib/api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await authApi.requestPasswordReset(email);
      // The API answers the same way whether or not the account exists.
      setNotice(result?.message || "If an account exists for that email, a reset link has been sent.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Reset your password" description="Enter your account email and we will send you a reset link." footer={<Link href="/login" className="font-bold text-brand-600">Back to sign in</Link>}>
      <form onSubmit={submit}>
        <FormError message={error} />
        <FormNotice message={notice} />
        <label className="block text-xs font-bold text-slate-700">Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label>
        <Button variant="primary" disabled={submitting} className="mt-5 w-full">{submitting ? "Sending…" : "Send reset link"}</Button>
      </form>
    </AuthCard>
  );
}
