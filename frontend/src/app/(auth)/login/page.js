"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { safeNext, useSession } from "@/components/providers/SessionProvider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState(searchParams.get("expired") ? "Your session has ended. Please sign in again." : "");
  const [submitting, setSubmitting] = useState(false);
  const next = safeNext(searchParams.get("next"));

  useEffect(() => {
    if (status === "authenticated" && !submitting) router.replace(next);
  }, [status, submitting, next, router]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ email, password, rememberMe });
      router.replace(next);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-sm font-black">HI</span><span className="text-sm font-bold">Hiring Intelligence</span></div>
        <div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-100">Commercial hiring signals</p><h1 className="mt-4 text-5xl font-black leading-tight tracking-tight">Turn hiring activity into qualified business opportunities.</h1><p className="mt-5 text-base leading-7 text-slate-400">Find fresh, deduplicated companies with real hiring intent, transparent lead scores, and verified source data.</p></div>
        <p className="text-xs text-slate-500">Built for agencies, recruiters and business development teams.</p>
      </section>
      <section className="flex items-center justify-center bg-canvas p-6">
        <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
          <div className="lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-sm font-black text-white">HI</span></div>
          <h2 className="mt-4 text-2xl font-black text-slate-900">Welcome back</h2><p className="mt-1 text-sm text-slate-500">Sign in to your hiring intelligence workspace.</p>
          {error ? <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div> : null}
          <label className="mt-6 block text-xs font-bold text-slate-700">Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label>
          <label className="mt-4 block text-xs font-bold text-slate-700">Password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /></label>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><label className="flex items-center gap-2"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="accent-brand-600" />Remember me</label><Link href="/forgot-password" className="font-semibold text-brand-600">Forgot password?</Link></div>
          <button disabled={submitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Sign in</button>
          <p className="mt-5 text-center text-xs text-slate-500">New workspace? <Link href="/onboarding" className="font-bold text-brand-600">Create an account</Link></p>
        </form>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
