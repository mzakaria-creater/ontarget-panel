import { useEffect, useState } from 'react'
import TableSkeleton from './Skeleton'
import EmptyState from './EmptyState'
import TablePagination from './TablePagination'

export default function DataTable({
  columns,
  data,
  loading,
  error,
  getRowKey = (row, i) => row.id ?? i,
  onRowClick,
  rowClassName,
  emptyEmoji = '📭',
  emptyTitle = 'لا توجد بيانات',
  emptySubtitle,
  selectable = false,
  selectedKeys,
  onToggleRow,
  onToggleAll,
  paginated = true,
  columnStorageKey,
}) {
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [role] = useState(() => localStorage.getItem('ontarget-role') || 'operator')
  const [visibleKeys, setVisibleKeys] = useState(() => columns.map((column) => column.key))
  const [columnsOpen, setColumnsOpen] = useState(false)
  const storageKey = columnStorageKey ? `ontarget-columns:${columnStorageKey}:${role}` : ''
  const activeColumns = columnStorageKey ? columns.filter((column) => visibleKeys.includes(column.key)) : columns
  useEffect(() => {
    if (!columnStorageKey) return
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
      setVisibleKeys(Array.isArray(saved) && saved.length ? saved : columns.map((column) => column.key))
    } catch { setVisibleKeys(columns.map((column) => column.key)) }
  }, [columnStorageKey, storageKey])
  function toggleColumn(key) {
    const next = visibleKeys.includes(key) ? visibleKeys.filter((item) => item !== key) : [...visibleKeys, key]
    if (!next.length) return
    setVisibleKeys(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }
  useEffect(() => setPage(1), [data])

  if (loading) return <TableSkeleton columns={activeColumns.length + (selectable ? 1 : 0)} />

  if (error) {
    return (
      <EmptyState emoji="⚠️" title="تعذر تحميل البيانات" subtitle={String(error.message || error)} />
    )
  }

  if (!data || data.length === 0) {
    return <EmptyState emoji={emptyEmoji} title={emptyTitle} subtitle={emptySubtitle} />
  }

  const pageCount = Math.max(1, Math.ceil(data.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleData = paginated ? data.slice((safePage - 1) * pageSize, safePage * pageSize) : data

  const allSelected = selectable && visibleData.length > 0 && visibleData.every((row, i) => selectedKeys?.has(getRowKey(row, i)))

  return (
    <div className="max-w-full rounded-xl border border-border bg-card">
      {columnStorageKey && <div className="flex items-center justify-end gap-2 border-b border-border bg-surface px-3 py-2 text-xs">
        <span className="text-muted">Columns · role: <b className="text-gold">{role}</b></span>
        <button type="button" onClick={() => setColumnsOpen((open) => !open)} className="rounded-lg border border-border px-2 py-1 text-muted hover:border-gold hover:text-gold">⚙ Select columns</button>
        {columnsOpen && <div className="absolute z-30 mt-28 rounded-xl border border-border bg-card p-3 shadow-2xl">
          {columns.map((column) => <label key={column.key} className="flex items-center gap-2 px-2 py-1.5 text-text"><input type="checkbox" checked={visibleKeys.includes(column.key)} onChange={() => toggleColumn(column.key)} className="accent-gold" />{column.label}</label>)}
        </div>}
      </div>}
      <div className="macbook-data-desktop hidden overflow-x-auto md:block">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-right text-xs text-muted">
            {selectable && (
              <th className="w-10 px-4 py-3 font-bold">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
              </th>
            )}
            {activeColumns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-3 py-3 font-bold lg:px-4">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleData.map((row, i) => {
            const key = getRowKey(row, i)
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-border last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-surface/70' : ''} ${rowClassName?.(row) || ''}`}
              >
                {selectable && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedKeys?.has(key) || false}
                      onChange={() => onToggleRow?.(row, key)}
                      className="h-4 w-4 accent-gold"
                    />
                  </td>
                )}
                {activeColumns.map((col) => (
                  <td key={col.key} className="max-w-[280px] px-3 py-3 text-text lg:px-4">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>

      <div className="macbook-data-mobile space-y-3 p-3 md:hidden">
        {visibleData.map((row, i) => {
          const key = getRowKey(row, i)
          const primary = activeColumns[0]
          const secondary = activeColumns[1]
          const remaining = activeColumns.slice(2)
          return (
            <div key={key} onClick={() => onRowClick?.(row)} className={`rounded-2xl border border-border bg-surface p-4 shadow-sm ${onRowClick ? 'cursor-pointer active:scale-[0.99]' : ''} ${rowClassName?.(row) || ''}`}>
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                {selectable && <input type="checkbox" checked={selectedKeys?.has(key) || false} onChange={() => onToggleRow?.(row, key)} onClick={(e) => e.stopPropagation()} className="mt-1 h-4 w-4 shrink-0 accent-gold" />}
                <div className="min-w-0 flex-1"><div className="mb-1 text-[11px] font-semibold text-muted">{primary.label}</div><div className="truncate text-base font-bold text-text">{primary.render ? primary.render(row) : row[primary.key]}</div></div>
                {secondary && <div className="shrink-0 text-right"><div className="mb-1 text-[11px] font-semibold text-muted">{secondary.label}</div><div className="text-sm font-semibold text-text">{secondary.render ? secondary.render(row) : row[secondary.key]}</div></div>}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3">
                {remaining.map((col) => <div key={col.key} className="min-w-0"><div className="mb-1 text-[11px] font-semibold text-muted">{col.label}</div><div className="truncate text-sm text-text">{col.render ? col.render(row) : row[col.key] ?? '—'}</div></div>)}
              </div>
            </div>
          )
        })}
      </div>
      {paginated && <TablePagination total={data.length} page={safePage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />}
    </div>
  )
}
