import { useMemo, useState } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatAbsoluteDate, formatCairoDate, formatMoney, formatNumber, formatUtcDate } from '../utils/format'
import Topbar from '../components/Topbar'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'

export default function Complaints() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)
  const table = useRealtimeTable({ key: ['tx-complaints'], queryFn: async (sb) => sb.from('tx_complaints').select('*').order('created_at', { ascending: false }).limit(1000), intervalMs: 10000 })
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (table.data || []).filter((row) => (!status || row.status === status) && (!term || [row.tx_id, row.customer_phone, row.note, row.finding, row.admin_note].some((value) => String(value ?? '').toLowerCase().includes(term))))
  }, [table.data, search, status])
  const columns = [
    { key: 'tx_id', label: 'رقم العملية', render: (row) => <a href={`/monitor?tx=${row.tx_id}`} className="font-mono font-bold text-gold underline">{row.tx_id}</a> },
    { key: 'customer_phone', label: 'رقم العميل' },
    { key: 'amount', label: 'المبلغ', render: (row) => formatMoney(row.amount) },
    { key: 'status', label: 'الحالة', render: (row) => <Badge status={row.status} /> },
    { key: 'finding', label: 'النتيجة', render: (row) => row.finding || 'بانتظار المراجعة' },
    { key: 'created_at', label: 'وقت الإنشاء القاهرة', render: (row) => formatCairoDate(row.created_at) },
  ]
  return <div className="flex h-full flex-col bg-bg"><Topbar title="مهام الشكاوى" subtitle={`${formatNumber(rows.length)} شكوى مرتبطة بالمعاملات`} onRefresh={table.refresh} isFetching={table.isFetching} /><div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6"><div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4"><div className="min-w-[240px] flex-1"><label className="mb-1 block text-xs text-muted">بحث</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="رقم العملية، الهاتف، الملاحظة..." className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /></div><div><label className="mb-1 block text-xs text-muted">الحالة</label><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"><option value="">الكل</option><option value="open">مفتوحة</option><option value="pending">معلقة</option><option value="resolved">محلولة</option></select></div><button onClick={() => { setSearch(''); setStatus('') }} className="rounded-lg border border-border px-3 py-2 text-sm text-muted">مسح الفلاتر</button></div><DataTable columns={columns} data={rows} loading={table.isLoading} error={table.error} onRowClick={setSelected} getRowKey={(row) => row.id} emptyEmoji="🧩" emptyTitle="لا توجد شكاوى" emptySubtitle="يمكن إنشاء شكوى من تفاصيل المعاملة" /></div><Modal open={!!selected} onClose={() => setSelected(null)} title={`تفاصيل شكوى العملية ${selected?.tx_id || ''}`} width="max-w-2xl">{selected && <div className="space-y-4"><div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-4 text-sm md:grid-cols-3"><div><div className="text-xs text-muted">رقم العملية</div><a href={`/monitor?tx=${selected.tx_id}`} className="mt-1 block font-mono font-bold text-gold underline">{selected.tx_id}</a></div><div><div className="text-xs text-muted">المبلغ</div><div className="mt-1 font-bold text-gold">{formatMoney(selected.amount)}</div></div><div><div className="text-xs text-muted">الحالة</div><div className="mt-1"><Badge status={selected.status} /></div></div><div><div className="text-xs text-muted">وقت القاهرة</div><div className="mt-1 text-text">{formatCairoDate(selected.created_at)}</div></div><div><div className="text-xs text-muted">UTC</div><div className="mt-1 text-text">{formatUtcDate(selected.created_at)}</div></div><div><div className="text-xs text-muted">رقم العميل</div><div className="mt-1 text-text">{selected.customer_phone || '—'}</div></div></div><div className="rounded-xl border border-border bg-card p-4 text-sm"><div className="text-xs text-muted">الملاحظة</div><div className="mt-1 whitespace-pre-wrap text-text">{selected.note || '—'}</div><div className="mt-4 text-xs text-muted">النتيجة</div><div className="mt-1 whitespace-pre-wrap text-text">{selected.finding || '—'}</div><div className="mt-4 text-xs text-muted">ملاحظة المشرف</div><div className="mt-1 whitespace-pre-wrap text-text">{selected.admin_note || '—'}</div></div></div>}</Modal></div>
}
