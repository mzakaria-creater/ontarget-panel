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
}) {
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [data])

  if (loading) return <TableSkeleton columns={columns.length + (selectable ? 1 : 0)} />

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
      <div className="hidden overflow-x-auto md:block">
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
            {columns.map((col) => (
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
                {columns.map((col) => (
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

      <div className="space-y-3 p-3 md:hidden">
        {visibleData.map((row, i) => {
          const key = getRowKey(row, i)
          const primary = columns[0]
          const secondary = columns[1]
          const remaining = columns.slice(2)
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
