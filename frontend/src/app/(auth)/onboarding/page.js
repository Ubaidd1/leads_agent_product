"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { profileApi } from "@/lib/api/profile";
import { FRESHNESS, REGIONS, SERVICE_TYPES, TECHNOLOGIES, regionLabel, freshnessLabel } from "@/lib/constants";

const inputClass = "mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10";
const ONBOARDING_REGIONS = REGIONS.filter(([value]) => ["worldwide", "united-states", "canada", "europe", "pakistan-allowed", "international-remote"].includes(value));

export default function OnboardingPage() {
  const router = useRouter();
  const { notify } = useToast();
  const { status, register } = useSession();
  // Step 0 is account creation and only appears when nobody is signed in.
  const [step, setStep] = useState(null);
  const [account, setAccount] = useState({ fullName: "", email: "", password: "", workspaceName: "" });
  const [selectedServices, setSelectedServices] = useState(["Software Development", "AI / ML"]);
  const [selectedTechnologies, setSelectedTechnologies] = useState(["React", "Node.js", "Python"]);
  const [region, setRegion] = useState("worldwide");
  const [freshnessDays, setFreshnessDays] = useState(7);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "loading" || step !== null) return;
    if (status !== "authenticated") return setStep(0);
    setStep(1);
    profileApi.getOnboarding().then(({ preferences }) => {
      if (!preferences) return;
      if (preferences.services?.length) setSelectedServices(preferences.services);
      if (preferences.technologies?.length) setSelectedTechnologies(preferences.technologies);
      setRegion(preferences.region);
      setFreshnessDays(preferences.freshnessDays);
    }).catch(() => {});
  }, [status, step]);

  function toggle(item, values, setter) { setter(values.includes(item) ? values.filter((value) => value !== item) : [...values, item]); }

  async function createAccount(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(account);
      setStep(1);
    } catch (err) {
      const fields = err.fieldErrors;
      setError(fields.password || fields.email || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setError("");
    setBusy(true);
    try {
      await profileApi.saveOnboarding({ services: selectedServices, technologies: selectedTechnologies, region, freshnessDays });
      notify("Workspace preferences saved.");
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (step === null) return <div className="flex min-h-screen items-center justify-center bg-canvas"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;

  const totalSteps = 4;
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-5">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-600">{step === 0 ? "Create your account" : `Workspace setup · Step ${step} of ${totalSteps}`}</p><h1 className="mt-1 text-xl font-black text-slate-900">{step === 0 ? "Start your hiring intelligence workspace" : "Configure your opportunity criteria"}</h1></div><div className="flex gap-1.5">{[1,2,3,4].map((value) => <span key={value} className={`h-1.5 w-8 rounded-full ${value <= step ? "bg-brand-600" : "bg-slate-200"}`} />)}</div></div>
        {error ? <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div> : null}
        {step === 0 ? (
          <form onSubmit={createAccount}>
            <div className="grid min-h-[330px] content-start gap-4 py-6 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-700">Full name<input required maxLength={200} autoComplete="name" value={account.fullName} onChange={(e) => setAccount({ ...account, fullName: e.target.value })} className={inputClass} /></label>
              <label className="text-xs font-bold text-slate-700">Workspace name<input required maxLength={200} placeholder="e.g. your agency" value={account.workspaceName} onChange={(e) => setAccount({ ...account, workspaceName: e.target.value })} className={inputClass} /></label>
              <label className="text-xs font-bold text-slate-700">Work email<input type="email" required autoComplete="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className={inputClass} /></label>
              <label className="text-xs font-bold text-slate-700">Password<input type="password" required minLength={10} autoComplete="new-password" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} className={inputClass} /><span className="mt-1 block text-[10px] font-normal text-slate-400">At least 10 characters.</span></label>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-5"><Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900">I already have an account</Link><button disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create account<ChevronRight className="h-4 w-4" /></button></div>
          </form>
        ) : (
          <>
            <div className="min-h-[330px] py-6">
              {step === 1 ? <><h2 className="text-sm font-bold text-slate-800">What services are you selling?</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{SERVICE_TYPES.map((item) => { const active = selectedServices.includes(item); return <button key={item} onClick={() => toggle(item, selectedServices, setSelectedServices)} className={`flex min-h-20 items-start justify-between rounded-xl border p-3 text-left text-xs font-bold ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{item}{active ? <Check className="h-4 w-4" /> : null}</button>; })}</div></> : null}
              {step === 2 ? <><h2 className="text-sm font-bold text-slate-800">Choose technologies and capabilities</h2><div className="mt-4 flex flex-wrap gap-2">{TECHNOLOGIES.map((item) => { const active = selectedTechnologies.includes(item); return <button key={item} onClick={() => toggle(item, selectedTechnologies, setSelectedTechnologies)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{item}</button>; })}</div></> : null}
              {step === 3 ? <><h2 className="text-sm font-bold text-slate-800">Where should companies be hiring?</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{ONBOARDING_REGIONS.map(([value, label]) => <button key={value} onClick={() => setRegion(value)} className={`rounded-xl border p-4 text-left text-xs font-bold ${region === value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}>{label}</button>)}</div></> : null}
              {step === 4 ? <><h2 className="text-sm font-bold text-slate-800">Review your default search</h2><div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Services</span><strong className="text-right">{selectedServices.join(", ") || "None"}</strong></div><div className="flex justify-between gap-4"><span className="text-slate-500">Technologies</span><strong className="text-right">{selectedTechnologies.join(", ") || "None"}</strong></div><div className="flex justify-between gap-4"><span className="text-slate-500">Geography</span><strong>{regionLabel(region)}</strong></div><label className="flex items-center justify-between gap-4"><span className="text-slate-500">Default freshness</span><select value={freshnessDays} onChange={(event) => setFreshnessDays(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">{FRESHNESS.map(([value]) => <option key={value} value={value}>{freshnessLabel(value)}</option>)}</select></label></div></> : null}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-5">{step > 1 ? <button onClick={() => setStep((value) => value - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" />Back</button> : <span />}{step < totalSteps ? <button onClick={() => setStep((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">Continue<ChevronRight className="h-4 w-4" /></button> : <button onClick={finish} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Start finding leads</button>}</div>
          </>
        )}
      </div>
    </div>
  );
}
