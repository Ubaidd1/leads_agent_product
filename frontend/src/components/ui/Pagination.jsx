import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZES } from "@/lib/constants";

/** Footer for a server-paginated Page<T>: "1–25 of 142", page size, prev/next. */
export default function Pagination({ page, pageSize, total, totalPages, onPage, onPageSize, noun = "results" }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
      <span>{from}–{to} of {total.toLocaleString()} {noun}</span>
      <div className="flex items-center gap-3">
        {onPageSize ? (
          <label className="flex items-center gap-2">Per page
            <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold">{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select>
          </label>
        ) : null}
        <span className="font-semibold">Page {totalPages ? page : 0} of {totalPages}</span>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
