"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { savedSearchesApi } from "@/lib/api/saved-searches";
import { criteriaSummary, criteriaToSaved } from "@/lib/criteria";
import { useToast } from "@/components/providers/ToastProvider";

export const FREQUENCIES = [
  ["manual", "Manual only"],
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["instant", "Instant (after each sync)"]
];

/** "Name this search" dialog: creates a saved search from the given criteria. */
export default function SaveSearchModal({ open, onClose, criteria, onSaved, defaultName = "" }) {
  const { notify } = useToast();
  const [name, setName] = useState(defaultName);
  const [frequency, setFrequency] = useState("daily");
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(defaultName); setError(""); }
  }, [open, defaultName]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const created = await savedSearchesApi.create({ name, criteria: criteriaToSaved(criteria), frequency, isActive: true, notifyInApp, notifyEmail });
      notify(`Saved search “${created.name}” created.`);
      onSaved?.(created);
      onClose();
    } catch (err) {
      setError(err.code === "CONFLICT" || err.status === 409 ? "A saved search with this name already exists." : Object.values(err.fieldErrors)[0] || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Save this search" description={criteriaSummary(criteria)}>
      <form onSubmit={submit} className="space-y-4">
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div> : null}
        <label className="block text-xs font-bold text-slate-700">Name<input autoFocus required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
        <label className="block text-xs font-bold text-slate-700">Run frequency<select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">{FREQUENCIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <fieldset className="space-y-2 text-xs text-slate-700"><legend className="mb-1 font-bold">Notify me about new matches</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked={notifyInApp} onChange={(e) => setNotifyInApp(e.target.checked)} className="accent-brand-600" />In-app alerts</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} className="accent-brand-600" />Email <span className="text-slate-400">(sent once an email provider is configured)</span></label>
        </fieldset>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={saving}>{saving ? "Saving…" : "Save search"}</Button></div>
      </form>
    </Modal>
  );
}
