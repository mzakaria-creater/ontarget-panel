import { useMemo, useState } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatAbsoluteDate, formatNumber } from '../utils/format'
import Topbar from '../components/Topbar'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'

export default function Blacklist() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [selected, setSelected] = useState(null)
  const table = useRealtimeTable({
    key: ['api-risk-blacklist'],
    queryFn: async (sb) => sb.from('api_risk_blacklist').select('*').order('created_at', { ascending: false }).limit(1000),
    intervalMs: 15000,
  })
  const types = useMemo(() => [...new Set((table.data || []).map((row) => row.type).filter(Boolean))].sort(), [table.data])
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (table.data || []).filter((row) => (!type || row.type === type) && (!term || [row.type, row.value, row.reason, row.merchant_id].some((value) => String(value ?? '').toLowerCase().includes(term))))
  }, [table.data, search, type])
  const columns = [
    { key: 'type', label: 'النوع', render: (row) => <span className="rounded-full bg-danger/10 px-2 py-1 text-xs font-bold text-danger">{row.type || '—'}</span> },
    { key: 'value', label: 'القيمة المحظورة', render: (row) => <span className="font-mono font-semibold text-text">{row.value || '—'}</span> },
    { key: 'reason', label: 'السبب', render: (row) => <span className="block max-w-[360px] truncate" title={row.reason}>{row.reason || '—'}</span> },
    { key: 'merchant_id', label: 'التاجر', render: (row) => row.merchant_id || 'كل التجار' },
    { key: 'created_at', label: 'تاريخ الإضافة', render: (row) => formatAbsoluteDate(row.created_at) },
  ]
  return <div className="flex h-full flex-col bg-bg">
    <Topbar title="القائمة السوداء" subtitle={`${formatNumber(rows.length)} عنصر محظور · تحديث تلقائي`} onRefresh={table.refresh} isFetching={table.isFetching} />
    <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3"><div className="rounded-2xl border border-border bg-card p-4"><div className="text-xs text-muted">إجمالي العناصر</div><div className="mt-2 text-2xl font-bold text-danger">{formatNumber(rows.length)}</div></div><div className="rounded-2xl border border-border bg-card p-4"><div className="text-xs text-muted">أرقام هواتف</div><div className="mt-2 text-2xl font-bold text-text">{formatNumber(rows.filter((row) => row.type === 'phone').length)}</div></div><div className="hidden rounded-2xl border border-border bg-card p-4 md:block"><div className="text-xs text-muted">آخر إضافة</div><div className="mt-2 text-sm font-bold text-gold">{rows[0] ? formatAbsoluteDate(rows[0].created_at) : '—'}</div></div></div>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4"><div className="min-w-[240px] flex-1"><label className="mb-1 block text-xs text-muted">بحث</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="رقم، سبب، تاجر..." className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted" /></div><div><label className="mb-1 block text-xs text-muted">النوع</label><select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"><option value="">الكل</option>{types.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><button onClick={() => { setSearch(''); setType('') }} className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text">مسح الفلاتر</button></div>
      <DataTable columns={columns} data={rows} loading={table.isLoading} error={table.error} onRowClick={setSelected} emptyEmoji="🚫" emptyTitle="لا توجد عناصر محظورة" emptySubtitle="ستظهر هنا الأرقام والقيم التي تم حظرها" />
    </div>
    <Modal open={!!selected} onClose={() => setSelected(null)} title="تفاصيل العنصر المحظور">{selected && <div className="grid grid-cols-2 gap-4 text-sm"><div><div className="text-xs text-muted">النوع</div><div className="mt-1 font-bold text-text">{selected.type || '—'}</div></div><div><div className="text-xs text-muted">القيمة</div><div className="mt-1 font-mono font-bold text-danger">{selected.value || '—'}</div></div><div className="col-span-2"><div className="text-xs text-muted">السبب</div><div className="mt-1 rounded-lg bg-surface p-3 text-text">{selected.reason || '—'}</div></div><div><div className="text-xs text-muted">التاجر</div><div className="mt-1 text-text">{selected.merchant_id || 'كل التجار'}</div></div><div><div className="text-xs text-muted">تاريخ الإضافة</div><div className="mt-1 text-text">{formatAbsoluteDate(selected.created_at)}</div></div></div>}</Modal>
  </div>
}
