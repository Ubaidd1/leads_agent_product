"use client";

import { useEffect, useState } from "react";
import { Mail, Trash2, UserPlus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Badge";
import { DataState, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/providers/ToastProvider";
import { useSession } from "@/components/providers/SessionProvider";
import { workspaceApi } from "@/lib/api/workspace";
import { useApi } from "@/lib/useApi";
import { CURRENCIES, REGIONS, ROLES, TIMEZONES } from "@/lib/constants";
import { formatDate, titleCase } from "@/lib/format";

const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-500";

function SettingsForm({ workspace, canEdit, onSaved }) {
  const { notify } = useToast();
  const [form, setForm] = useState(workspace);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setForm(workspace), [workspace]);

  async function save(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const updated = await workspaceApi.update({
        name: form.name,
        defaultCurrency: form.defaultCurrency,
        defaultGeography: form.defaultGeography,
        reportingTimezone: form.reportingTimezone,
        qualifiedThreshold: Number(form.qualifiedThreshold)
      });
      onSaved(updated);
      notify("Workspace settings saved.");
    } catch (err) {
      setError(Object.values(err.fieldErrors)[0] || err.message);
    } finally {
      setSaving(false);
    }
  }

  const zones = TIMEZONES.includes(form.reportingTimezone) ? TIMEZONES : [form.reportingTimezone, ...TIMEZONES];
  return (
    <form onSubmit={save} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {!canEdit ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Only workspace admins and owners can change these settings.</p> : null}
      {error ? <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div> : null}
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-700">Workspace name<input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
        <label className="text-xs font-bold text-slate-700">Default currency<select value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })} className={inputClass}>{CURRENCIES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-700">Default geography<select value={form.defaultGeography} onChange={(e) => setForm({ ...form, defaultGeography: e.target.value })} className={inputClass}>{REGIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{REGIONS.some(([value]) => value === form.defaultGeography) ? null : <option value={form.defaultGeography}>{form.defaultGeography}</option>}</select></label>
        <label className="text-xs font-bold text-slate-700">Reporting timezone<select value={form.reportingTimezone} onChange={(e) => setForm({ ...form, reportingTimezone: e.target.value })} className={inputClass}>{zones.map((zone) => <option key={zone}>{zone}</option>)}</select><span className="mt-1 block text-[10px] font-normal text-slate-400">Used to group dashboard and analytics dates.</span></label>
        <label className="text-xs font-bold text-slate-700 sm:col-span-2">Qualified lead threshold: {form.qualifiedThreshold}/100<input type="range" min="0" max="100" value={form.qualifiedThreshold} onChange={(e) => setForm({ ...form, qualifiedThreshold: Number(e.target.value) })} className="mt-3 w-full accent-brand-600" /><span className="mt-1 block text-[10px] font-normal text-slate-400">Open leads scoring at or above this count as “qualified” on the dashboard.</span></label>
      </fieldset>
      {canEdit ? <Button variant="primary" disabled={saving} className="mt-5">{saving ? "Saving…" : "Save workspace"}</Button> : null}
    </form>
  );
}

function Members({ canManage, currentUserId, isOwner }) {
  const { notify } = useToast();
  const members = useApi((signal) => workspaceApi.members({ signal }), []);
  const [busy, setBusy] = useState(null);

  async function changeRole(member, role) {
    setBusy(member.id);
    try {
      const updated = await workspaceApi.changeRole(member.id, role);
      members.setData((items) => items.map((item) => (item.id === member.id ? updated : item)));
      notify(`${member.fullName} is now ${titleCase(role)}.`);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(member) {
    const self = member.userId === currentUserId;
    if (!window.confirm(self ? "Leave this workspace?" : `Remove ${member.fullName} from this workspace?`)) return;
    setBusy(member.id);
    try {
      await workspaceApi.removeMember(member.id);
      if (self) return window.location.assign("/dashboard");
      members.setData((items) => items.filter((item) => item.id !== member.id));
      notify(`${member.fullName} removed.`);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mt-5 max-w-3xl overflow-hidden">
      <CardHeader title="Members" description="People with access to this workspace." />
      <DataState state={members} loading={<SkeletonRows rows={3} />}>
        {(items) => (
          <div className="divide-y divide-slate-100">
            {items.map((member) => {
              const self = member.userId === currentUserId;
              const editable = canManage && !self && (isOwner || member.role !== "owner");
              return (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{member.fullName}{self ? <span className="ml-2 text-[10px] font-semibold text-slate-400">You</span> : null}</p><p className="truncate text-xs text-slate-500">{member.email} · joined {formatDate(member.joinedAt)}</p></div>
                  <div className="flex items-center gap-2">
                    {editable ? <select aria-label={`Role for ${member.fullName}`} disabled={busy === member.id} value={member.role} onChange={(e) => changeRole(member, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold">{ROLES.filter((role) => isOwner || role !== "owner").map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}</select> : <StatusPill tone={member.role === "owner" ? "brand" : "slate"}>{titleCase(member.role)}</StatusPill>}
                    {editable || self ? <button disabled={busy === member.id} onClick={() => remove(member)} className="rounded-lg border border-rose-100 p-2 text-rose-500 hover:bg-rose-50" aria-label={self ? "Leave workspace" : `Remove ${member.fullName}`}><Trash2 className="h-3.5 w-3.5" /></button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DataState>
    </Card>
  );
}

function Invitations({ isOwner }) {
  const { notify } = useToast();
  const invitations = useApi((signal) => workspaceApi.invitations({ signal }), []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);

  async function invite(event) {
    event.preventDefault();
    setSending(true);
    try {
      const created = await workspaceApi.invite(email, role);
      invitations.setData((items) => [created, ...(items || [])]);
      setEmail("");
      notify(`Invitation created for ${created.email}.`);
    } catch (error) {
      notify(error.fieldErrors.email || error.message, "error");
    } finally {
      setSending(false);
    }
  }

  async function revoke(invitation) {
    try {
      await workspaceApi.revokeInvitation(invitation.id);
      invitations.setData((items) => items.filter((item) => item.id !== invitation.id));
      notify("Invitation revoked.", "info");
    } catch (error) {
      notify(error.message, "error");
    }
  }

  return (
    <Card className="mt-5 max-w-3xl overflow-hidden">
      <CardHeader title="Invitations" description="Pending invitations expire after 7 days." />
      <form onSubmit={invite} className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-4">
        <label className="min-w-[220px] flex-1 text-xs font-bold text-slate-700">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></label>
        <label className="text-xs font-bold text-slate-700">Role<select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>{ROLES.filter((item) => isOwner || item !== "owner").map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
        <Button variant="primary" disabled={sending}><UserPlus className="h-4 w-4" />{sending ? "Inviting…" : "Invite"}</Button>
      </form>
      <DataState state={invitations} loading={<SkeletonRows rows={2} />} isEmpty={(items) => !items.length} empty={<p className="p-4 text-xs text-slate-500">No pending invitations.</p>}>
        {(items) => (
          <div className="divide-y divide-slate-100">
            {items.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3"><Mail className="h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{invitation.email}</p><p className="text-[11px] text-slate-500">{titleCase(invitation.role)} · expires {formatDate(invitation.expiresAt)}</p></div></div>
                <Button variant="ghost" onClick={() => revoke(invitation)}>Revoke</Button>
              </div>
            ))}
          </div>
        )}
      </DataState>
    </Card>
  );
}

export default function WorkspacePage() {
  const { can, user, workspace: sessionWorkspace, refresh } = useSession();
  const workspace = useApi((signal) => workspaceApi.get({ signal }), [sessionWorkspace?.id]);
  const canManage = can("members:manage");
  const isOwner = sessionWorkspace?.role === "owner";

  return (
    <>
      <PageHeader eyebrow="Settings" title="Workspace" description="Configure organization-level defaults for searches, scoring and reporting, and manage who has access." />
      <DataState state={workspace} loading={<SkeletonRows rows={3} className="max-w-2xl rounded-2xl border border-slate-200 bg-white" />}>
        {(data) => <SettingsForm workspace={data} canEdit={can("workspace:update")} onSaved={(updated) => { workspace.setData(updated); refresh(); }} />}
      </DataState>
      <Members canManage={canManage} currentUserId={user.id} isOwner={isOwner} />
      {canManage ? <Invitations isOwner={isOwner} /> : null}
    </>
  );
}
