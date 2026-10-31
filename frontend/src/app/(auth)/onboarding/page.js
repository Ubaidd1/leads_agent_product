"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { keys, writeStorage } from "@/lib/storage";

const services = ["Software Development", "AI / ML", "Web Development", "Mobile Development", "SEO", "PPC", "Content", "Recruiting"];
const technologies = ["React", "Next.js", "Node.js", "Python", "Django", "FastAPI", "AWS", "Azure", "GCP", "LLM", "RAG", "Machine Learning"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState(["Software Development", "AI / ML"]);
  const [selectedTechnologies, setSelectedTechnologies] = useState(["React", "Node.js", "Python"]);
  const [geography, setGeography] = useState("Worldwide");
  const [freshness, setFreshness] = useState("7 days");

  function toggle(item, values, setter) { setter(values.includes(item) ? values.filter((value) => value !== item) : [...values, item]); }
  function finish() { writeStorage(keys.onboarding, { selectedServices, selectedTechnologies, geography, freshness }); router.push("/dashboard"); }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-5">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 pb-5"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-600">Workspace setup · Step {step} of 4</p><h1 className="mt-1 text-xl font-black text-slate-900">Configure your opportunity criteria</h1></div><div className="flex gap-1.5">{[1,2,3,4].map((value) => <span key={value} className={`h-1.5 w-8 rounded-full ${value <= step ? "bg-brand-600" : "bg-slate-200"}`} />)}</div></div>
        <div className="min-h-[330px] py-6">
          {step === 1 ? <><h2 className="text-sm font-bold text-slate-800">What services are you selling?</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{services.map((item) => { const active = selectedServices.includes(item); return <button key={item} onClick={() => toggle(item, selectedServices, setSelectedServices)} className={`flex min-h-20 items-start justify-between rounded-xl border p-3 text-left text-xs font-bold ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{item}{active ? <Check className="h-4 w-4" /> : null}</button>; })}</div></> : null}
          {step === 2 ? <><h2 className="text-sm font-bold text-slate-800">Choose technologies and capabilities</h2><div className="mt-4 flex flex-wrap gap-2">{technologies.map((item) => { const active = selectedTechnologies.includes(item); return <button key={item} onClick={() => toggle(item, selectedTechnologies, setSelectedTechnologies)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{item}</button>; })}</div></> : null}
          {step === 3 ? <><h2 className="text-sm font-bold text-slate-800">Where should companies be hiring?</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{["Worldwide", "United States", "Canada", "Europe", "Pakistan Allowed", "International Remote"].map((item) => <button key={item} onClick={() => setGeography(item)} className={`rounded-xl border p-4 text-left text-xs font-bold ${geography === item ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"}`}>{item}</button>)}</div></> : null}
          {step === 4 ? <><h2 className="text-sm font-bold text-slate-800">Review your default search</h2><div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Services</span><strong className="text-right">{selectedServices.join(", ")}</strong></div><div className="flex justify-between gap-4"><span className="text-slate-500">Technologies</span><strong className="text-right">{selectedTechnologies.join(", ")}</strong></div><div className="flex justify-between gap-4"><span className="text-slate-500">Geography</span><strong>{geography}</strong></div><label className="flex items-center justify-between gap-4"><span className="text-slate-500">Default freshness</span><select value={freshness} onChange={(event) => setFreshness(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><option>24 hours</option><option>3 days</option><option>7 days</option><option>14 days</option></select></label></div></> : null}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-5">{step > 1 ? <button onClick={() => setStep((value) => value - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" />Back</button> : <span />}{step < 4 ? <button onClick={() => setStep((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">Continue<ChevronRight className="h-4 w-4" /></button> : <button onClick={finish} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700">Start finding leads</button>}</div>
      </div>
    </div>
  );
}
