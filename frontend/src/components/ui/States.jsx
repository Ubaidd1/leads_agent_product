import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} aria-hidden="true" />;
}

/** Placeholder rows matching a table or list while data loads. */
export function SkeletonRows({ rows = 5, className = "" }) {
  return (
    <div className={`divide-y divide-slate-100 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 p-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-2.5 w-1/5" /></div>
          <Skeleton className="h-6 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4, className = "h-24" }) {
  return Array.from({ length: count }, (_, index) => <Skeleton key={index} className={`rounded-2xl ${className}`} />);
}

export function EmptyState({ title, description, action, icon: Icon = Inbox, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm ${className}`}>
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-400"><Icon className="h-5 w-5" /></span>
      <h3 className="mt-3 text-sm font-bold text-slate-900">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Could not load this data", className = "" }) {
  return (
    <div role="alert" className={`rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center ${className}`}>
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-600"><AlertTriangle className="h-5 w-5" /></span>
      <h3 className="mt-3 text-sm font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-600">{error?.message || "Something went wrong."}</p>
      {error?.requestId ? <p className="mt-1 text-[10px] text-slate-400">Reference: {error.requestId}</p> : null}
      {onRetry ? <Button className="mt-4" onClick={() => onRetry()}><RefreshCw className="h-4 w-4" />Try again</Button> : null}
    </div>
  );
}

/** Renders loading / error / empty / content for a useApi result. */
export function DataState({ state, loading, empty, isEmpty, children, errorTitle }) {
  if (state.loading && state.data === undefined) return loading ?? <SkeletonRows />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} title={errorTitle} />;
  if (state.data === undefined) return null;
  if (isEmpty?.(state.data)) return empty ?? null;
  return children(state.data);
}
