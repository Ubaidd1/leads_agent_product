import Link from "next/link";

/** Centered card used by the secondary auth pages (forgot/reset password, accept invitation). */
export default function AuthCard({ title, description, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
        <Link href="/login" className="inline-flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-sm font-black text-white">HI</span><span className="text-sm font-bold text-slate-900">Hiring Intelligence</span></Link>
        <h1 className="mt-5 text-2xl font-black text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-5 text-center text-xs text-slate-500">{footer}</div> : null}
      </div>
    </div>
  );
}

export const inputClass = "mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10";

export function FormError({ message }) {
  if (!message) return null;
  return <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{message}</div>;
}

export function FormNotice({ message }) {
  if (!message) return null;
  return <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{message}</div>;
}
