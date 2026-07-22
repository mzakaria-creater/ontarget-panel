import { useMemo } from 'react'

export default function TablePagination({ total, page, pageSize, onPageChange, onPageSizeChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = total ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(total, page * pageSize)
  const pages = useMemo(() => [...new Set([1, pageCount, page - 1, page, page + 1])].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b), [page, pageCount])
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 text-xs text-muted">
    <span>Showing {start}–{end} of {total}</span>
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2">Rows<select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-text">{[50, 100, 250, 500].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded-lg border border-border px-3 py-1.5 text-text disabled:opacity-40">Previous</button>
      <div className="hidden items-center gap-1 sm:flex">{pages.map((value, index) => <span key={value} className="flex items-center gap-1">{index > 0 && value - pages[index - 1] > 1 && <span>…</span>}<button onClick={() => onPageChange(value)} className={`min-w-8 rounded-lg px-2 py-1.5 ${value === page ? 'bg-gold font-bold text-bg' : 'border border-border text-text'}`}>{value}</button></span>)}</div>
      <span className="sm:hidden">{page}/{pageCount}</span>
      <button disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="rounded-lg border border-border px-3 py-1.5 text-text disabled:opacity-40">Next</button>
    </div>
  </div>
}
