import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { fetchRecoveryCandidates } from '../utils/recoveryMatch'
import { loadFilters, saveFilters } from '../utils/storage'
import { formatMoney, formatNumber, formatAbsoluteDate } from '../utils/format'
import { useToast } from '../components/Toast'
import Topbar from '../components/Topbar'
import StatCard from '../components/StatCard'
import DataTable from '../components/DataTable'
import Badge from '../components/Badge'
import Modal from '../components/Modal'

const PAGE_KEY = 'recovery'
const WINDOW_OPTIONS = [
  { value: 2, label: '2 ساعة' },
  { value: 6, label: '6 ساعات' },
  { value: 24, label: '24 ساعة' },
  { value: 48, label: '48 ساعة' },
]

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function Recovery() {
  const { showToast } = useToast()
  const [windowHours, setWindowHours] = useState(() => loadFilters(PAGE_KEY, { windowHours: 2 }).windowHours)
  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  const setWindow = (hours) => {
    setWindowHours(hours)
    saveFilters(PAGE_KEY, { windowHours: hours })
    setSelectedKeys(new Set())
  }

  const candidatesQuery = useRealtimeTable({
    key: ['recovery-candidates', windowHours],
    queryFn: async () => ({ data: await fetchRecoveryCandidates(windowHours) }),
    intervalMs: 60000,
  })

  const recoveredTodayQuery = useRealtimeTable({
    key: ['recovery-recovered-today'],
    queryFn: async (sb) =>
      sb.from('inbound_sms').select('consumed_by_tx_id').not('consumed_by_tx_id', 'is', null).gte('received_at', startOfTodayIso()),
    intervalMs: 60000,
  })

  const candidates = candidatesQuery.data || []

  const stats = useMemo(() => {
    const totalAmount = candidates.reduce((sum, c) => sum + Number(c.tx.amount || 0), 0)
    const oldest = candidates.reduce((max, c) => Math.max(max, c.diffMinutes), 0)
    const recoveredToday = new Set((recoveredTodayQuery.data || []).map((r) => r.consumed_by_tx_id)).size
    return {
      pending: candidates.length,
      totalAmount,
      recoveredToday,
      oldest,
    }
  }, [candidates, recoveredTodayQuery.data])

  const getRowKey = (c) => c.tx.tx_id

  const toggleRow = (row, key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = (checked) => {
    if (checked) setSelectedKeys(new Set(candidates.map(getRowKey)))
    else setSelectedKeys(new Set())
  }

  async function recoverOne(candidate) {
    const { tx, sms } = candidate

    const { error: patchError } = await supabase
      .from('inbound_sms')
      .update({ consumed_by_tx_id: tx.tx_id })
      .eq('id', sms.id)

    if (patchError) throw patchError

    const workerResponse = await fetch('/api/maven-worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ single_tx: tx.tx_id, single_status: 'PAID', allow_reversal: true }),
    })
    if (!workerResponse.ok) throw new Error((await workerResponse.text()).slice(0, 300))
  }

  async function runRecovery(items) {
    setRecovering(true)
    setProgress(0)
    let done = 0

    for (const candidate of items) {
      try {
        await recoverOne(candidate)
        showToast(`تم استرجاع العملية ${candidate.tx.tx_id} بنجاح`, 'success')
      } catch (err) {
        showToast(`فشل استرجاع العملية ${candidate.tx.tx_id}: ${err.message || err}`, 'error')
      }
      done += 1
      setProgress(Math.round((done / items.length) * 100))
    }

    setRecovering(false)
    setConfirmOpen(false)
    setSelectedKeys(new Set())
    candidatesQuery.refresh()
    recoveredTodayQuery.refresh()
  }

  const selectedCandidates = candidates.filter((c) => selectedKeys.has(getRowKey(c)))

  const columns = [
    { key: 'tx_id', label: 'رقم العملية', render: (c) => c.tx.tx_id },
    { key: 'sender_name', label: 'اسم المرسل', render: (c) => c.tx.sender_name },
    { key: 'sender_number', label: 'رقم المرسل', render: (c) => c.tx.sender_number },
    { key: 'amount', label: 'المبلغ', render: (c) => formatMoney(c.tx.amount) },
    { key: 'payment_method', label: 'وسيلة الدفع', render: (c) => c.tx.payment_method },
    { key: 'diff_minutes', label: 'الفارق الزمني', render: (c) => `${formatNumber(c.diffMinutes)} دقيقة` },
    { key: 'confirmed', label: 'الحالة', render: () => <Badge>مؤكدة برسالة SMS ✅</Badge> },
    {
      key: 'action',
      label: '',
      render: (c) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            runRecovery([c])
          }}
          disabled={recovering}
          className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-bg hover:opacity-90 disabled:opacity-40"
        >
          ⚡ استرجاع
        </button>
      ),
    },
    {
      key: 'details',
      label: 'التفاصيل',
      render: (c) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setSelectedCandidate(c)
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-text hover:border-gold/60 hover:text-gold"
        >
          عرض التفاصيل
        </button>
      ),
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <Topbar
        title="استرجاع العمليات المرفوضة"
        subtitle="مطابقة العمليات المرفوضة برسائل SMS غير المستهلكة"
        onRefresh={candidatesQuery.refresh}
        isFetching={candidatesQuery.isFetching}
      />

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="حالات معلقة" value={formatNumber(stats.pending)} tone="warning" icon="⏳" />
          <StatCard label="إجمالي المبلغ" value={formatMoney(stats.totalAmount)} icon="💰" />
          <StatCard label="مسترجعة اليوم" value={formatNumber(stats.recoveredToday)} tone="success" icon="✅" />
          <StatCard label="أقدم حالة" value={`${formatNumber(stats.oldest)} دقيقة`} tone="danger" icon="⏰" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">نافذة الوقت:</span>
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setWindow(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  windowHours === opt.value ? 'bg-gold text-bg' : 'border border-border text-text hover:border-gold/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setConfirmOpen(true)}
            disabled={selectedKeys.size === 0 || recovering}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-bg hover:opacity-90 disabled:opacity-40"
          >
            استرجاع الكل المحدد ({formatNumber(selectedKeys.size)})
          </button>
        </div>

        {recovering && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <DataTable
          columns={columns}
          data={candidates}
          loading={candidatesQuery.isLoading}
          error={candidatesQuery.error}
          getRowKey={getRowKey}
          onRowClick={setSelectedCandidate}
          selectable
          selectedKeys={selectedKeys}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          emptyEmoji="🎉"
          emptyTitle="لا توجد حالات مطابقة للاسترجاع"
          emptySubtitle="كل العمليات المرفوضة تمت معالجتها"
        />
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !recovering && setConfirmOpen(false)}
        title="تأكيد الاسترجاع الجماعي"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={recovering}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text disabled:opacity-40"
            >
              إلغاء
            </button>
            <button
              onClick={() => runRecovery(selectedCandidates)}
              disabled={recovering}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-bg hover:opacity-90 disabled:opacity-40"
            >
              {recovering ? 'جاري الاسترجاع...' : 'تأكيد الاسترجاع'}
            </button>
          </>
        }
      >
        <p className="text-sm text-text">
          سيتم استرجاع {formatNumber(selectedCandidates.length)} عملية بإجمالي{' '}
          {formatMoney(selectedCandidates.reduce((s, c) => s + Number(c.tx.amount || 0), 0))} جنيه. هل أنت متأكد؟
        </p>
      </Modal>

      <Modal
        open={!!selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        title={selectedCandidate ? `تفاصيل العملية المرفوضة #${selectedCandidate.tx.tx_id}` : 'تفاصيل العملية'}
        footer={selectedCandidate ? (
          <div className="flex w-full items-center justify-between gap-2">
            <Badge status={selectedCandidate.tx.status}>{selectedCandidate.tx.status}</Badge>
            <div className="flex gap-2">
              <button onClick={() => setSelectedCandidate(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-text">إغلاق</button>
              <button
                onClick={() => { setSelectedCandidate(null); runRecovery([selectedCandidate]) }}
                disabled={recovering}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-bg disabled:opacity-40"
              >⚡ استرجاع العملية</button>
            </div>
          </div>
        ) : null}
      >
        {selectedCandidate && <RecoveryTransactionDetails candidate={selectedCandidate} />}
      </Modal>
    </div>
  )
}

function RecoveryTransactionDetails({ candidate }) {
  const { tx, sms, diffMinutes } = candidate
  const fields = [
    ['رقم العملية', tx.tx_id],
    ['الحالة', tx.status],
    ['المبلغ', `${formatMoney(tx.amount)} ج.م`],
    ['التاجر', tx.merchant || tx.sub_merchant || '—'],
    ['التاجر الفرعي', tx.sub_merchant || '—'],
    ['طريقة الدفع', tx.payment_method || '—'],
    ['اسم المرسل', tx.sender_name || '—'],
    ['رقم المرسل', tx.sender_number || '—'],
    ['وقت إنشاء العملية', formatAbsoluteDate(tx.created_utc)],
    ['آخر تعديل', formatAbsoluteDate(tx.modified_utc || tx.updated_at)],
    ['من وافق', tx.approved_by || '—'],
    ['طريقة التنفيذ', tx.operation_by || '—'],
  ]

  return <div className="space-y-5">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-surface px-3 py-2"><div className="text-[11px] font-semibold text-muted">{label}</div><div className="mt-1 break-words text-sm font-semibold text-text">{value}</div></div>)}
    </div>
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold text-gold">📨 رسالة SMS المطابقة</h3><span className="text-xs text-muted">الفارق: {formatNumber(diffMinutes)} دقيقة</span></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Detail label="رقم SMS" value={sms.id} />
        <Detail label="المبلغ" value={`${formatMoney(sms.amount)} ج.م`} />
        <Detail label="المرسل" value={sms.sender_name || sms.sender_number || '—'} />
        <Detail label="وقت الاستلام" value={formatAbsoluteDate(sms.received_at)} />
        <Detail label="الفئة" value={sms.sms_category || '—'} />
        <Detail label="حالة المطابقة" value="مطابقة مؤكدة ✅" />
      </div>
      {(sms.message || sms.raw_sms) && <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-bg p-3 text-xs leading-6 text-muted">{sms.message || sms.raw_sms}</pre>}
    </div>
    {tx.raw && <details className="rounded-xl border border-border bg-surface p-3"><summary className="cursor-pointer text-sm font-semibold text-text">البيانات الخام للعملية</summary><pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-muted">{JSON.stringify(tx.raw, null, 2)}</pre></details>}
  </div>
}

function Detail({ label, value }) {
  return <div><div className="text-[11px] text-muted">{label}</div><div className="mt-1 text-sm font-semibold text-text">{value}</div></div>
}
