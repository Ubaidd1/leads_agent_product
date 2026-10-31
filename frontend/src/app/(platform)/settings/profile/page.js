"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { profileApi } from "@/lib/api/profile";
import { TIMEZONES } from "@/lib/constants";

const inputClass = "mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm";

function FieldError({ message }) {
  return message ? <span className="mt-1 block text-[11px] font-semibold text-rose-600">{message}</span> : null;
}

export default function ProfilePage() {
  const { notify } = useToast();
  const { user, refresh } = useSession();
  const [form, setForm] = useState({ fullName: user.fullName, email: user.email, jobTitle: user.jobTitle || "", timezone: user.timezone });
  const [currentPassword, setCurrentPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const emailChanged = form.email.trim().toLowerCase() !== user.email;
  const timezones = TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES];

  async function save(event) {
    event.preventDefault();
    setErrors({});
    setSaving(true);
    const changes = { fullName: form.fullName, jobTitle: form.jobTitle || null, timezone: form.timezone };
    if (emailChanged) Object.assign(changes, { email: form.email, currentPassword });
    try {
      await profileApi.update(changes);
      await refresh();
      setCurrentPassword("");
      notify("Profile saved.");
    } catch (error) {
      setErrors({ ...error.fieldErrors, form: Object.keys(error.fieldErrors).length ? "" : error.message });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (passwords.next !== passwords.confirm) return setPasswordError("The new passwords do not match.");
    setPasswordError("");
    setChangingPassword(true);
    try {
      await profileApi.changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      notify("Password changed. Other sessions have been signed out.");
    } catch (error) {
      setPasswordError(error.fieldErrors.newPassword || error.message);
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Settings" title="Profile" description="Manage personal details shown across your workspace." />
      <form onSubmit={save} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {errors.form ? <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{errors.form}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">Full name<input required maxLength={200} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputClass} /><FieldError message={errors.fullName} /></label>
          <label className="text-xs font-bold text-slate-700">Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /><FieldError message={errors.email} /></label>
          <label className="text-xs font-bold text-slate-700">Job title<input maxLength={200} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={inputClass} /><FieldError message={errors.jobTitle} /></label>
          <label className="text-xs font-bold text-slate-700">Timezone<select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={`${inputClass} bg-white`}>{timezones.map((zone) => <option key={zone}>{zone}</option>)}</select><FieldError message={errors.timezone} /></label>
          {emailChanged ? <label className="text-xs font-bold text-slate-700 sm:col-span-2">Current password (required to change email)<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} /><FieldError message={errors.currentPassword} /></label> : null}
        </div>
        <Button variant="primary" disabled={saving} className="mt-5">{saving ? "Saving…" : "Save profile"}</Button>
      </form>

      <form onSubmit={changePassword} className="mt-5 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Change password</h2>
        <p className="mt-1 text-xs text-slate-500">At least 10 characters. Your other signed-in sessions will be signed out.</p>
        {passwordError ? <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{passwordError}</div> : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-bold text-slate-700">Current password<input type="password" required autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} className={inputClass} /></label>
          <label className="text-xs font-bold text-slate-700">New password<input type="password" required minLength={10} autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} className={inputClass} /></label>
          <label className="text-xs font-bold text-slate-700">Confirm new password<input type="password" required minLength={10} autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} className={inputClass} /></label>
        </div>
        <Button disabled={changingPassword} className="mt-5">{changingPassword ? "Updating…" : "Update password"}</Button>
      </form>
    </>
  );
}
