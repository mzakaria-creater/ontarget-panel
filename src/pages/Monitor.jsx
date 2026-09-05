import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { loadFilters, saveFilters } from '../utils/storage'
import { formatMoney, formatNumber, formatRelativeTime, formatAbsoluteDate } from '../utils/format'
import Topbar from '../components/Topbar'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import SystemPulse from '../components/SystemPulse'
import TransactionSmsTable from '../components/TransactionSmsTable'

const PAGE_KEY = 'monitor'
const DEFAULT_FILTERS = { status: '', payment_method: '', dateFrom: '', dateTo: '' }

// يحدد الـ Edge Function الصحيح حسب التاجر الرئيسي الفعلي للمعاملة.
// لا تفترض provider افتراضي أبداً — أي تاجر جديد يُضاف هنا صراحة.
function workerEndpointFor(masterMerchant) {
  const key = String(masterMerchant || '').toLowerCase()
  if (key === 'payfuture') return '/api/payfuture-worker'
  if (key === 'ngpay') return '/api/ngpay-worker'
  throw new Error(`لا يوجد مسار تنفيذ معروف لهذا التاجر: ${masterMerchant || '(فارغ)'}`)
}

// اسم عرض محايد للتاجر، يُستخدم في رسائل النجاح/الخطأ بدل تثبيت اسم واحد
function providerLabel(masterMerchant) {
  const key = String(masterMerchant || '').toLowerCase()
  if (key === 'payfuture') return 'PayFuture'
  if (key === 'ngpay') return 'NGPay'
  return 'OnTarget'
}

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function operationBy(tx, job) {
  const source = String(job?.source || tx?.operation_by || '').toLowerCase()
  if (source.includes('auto') || source.includes('automation') || source.includes('ai') || source.includes('claude') || source.includes('n8n')) return 'AI'
  if (source.includes('manual') || source.includes('dashboard') || source.includes('telegram') || source.includes('operator') || source.includes('review') || source.includes('complaint')) return 'Manual'
  if (source.includes('maven')) return 'Maven'
  const raw = tx?.raw && typeof tx.raw === 'object' ? tx.raw : tx?.maven_raw_row && typeof tx.maven_raw_row === 'object' ? tx.maven_raw_row : {}
  const explicit = tx?.operation_by || raw.operation_by || raw.operationBy || raw.approval_source || raw.source
  const value = String(explicit || '').toLowerCase()
  if (value.includes('ai') || value.includes('auto') || value.includes('bot')) return 'AI'
  if (value.includes('manual') || value.includes('operator') || value.includes('user')) return 'Manual'
  if (tx?.approved_by) return 'Manual'
  return 'Maven'
}

export default function Monitor() {
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState(() => loadFilters(PAGE_KEY, DEFAULT_FILTERS))
  const [selectedTx, setSelectedTx] = useState(null)
  const [pageSize, setPageSize] = useState(100)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [search, setSearch] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [proofUrl, setProofUrl] = useState(null)
  const [selectedPhone, setSelectedPhone] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  const updateFilter = (patch) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    saveFilters(PAGE_KEY, next)
  }

  const kpis = useRealtimeTable({
    key: ['monitor-kpis'],
    queryFn: async (sb) =>
      sb.from('maven_transactions').select('status, amount, created_utc').gte('created_utc', startOfTodayIso()),
    intervalMs: autoRefresh ? 15000 : 0,
  })

  const table = useRealtimeTable({
    key: ['monitor-table', filters, pageSize, search],
    queryFn: async (sb) => {
      let query = sb.from('maven_transactions').select('*').order('created_utc', { ascending: false }).limit(pageSize)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.payment_method) query = query.ilike('payment_method', `%${filters.payment_method}%`)
      if (filters.dateFrom) query = query.gte('created_utc', new Date(filters.dateFrom).toISOString())
      if (filters.dateTo) query = query.lte('created_utc', new Date(filters.dateTo).toISOString())
      const term = search.trim()
      if (term) {
        if (/^\d+$/.test(term)) query = query.eq('tx_id', Number(term))
        else {
          const safeTerm = term.replace(/[(),]/g, ' ')
          query = query.or(`sender_name.ilike.%${safeTerm}%,sender_number.ilike.%${safeTerm}%,payment_method.ilike.%${safeTerm}%,merchant.ilike.%${safeTerm}%,sub_merchant.ilike.%${safeTerm}%,status.ilike.%${safeTerm}%`)
        }
      }
      return query
    },
    intervalMs: autoRefresh ? 15000 : 0,
  })

  const reviewQuery = useRealtimeTable({
    key: ['review-queue', selectedTx?.tx_id],
    queryFn: async (sb) => sb.from('review_queue').select('*').eq('tx_id', selectedTx?.tx_id),
    intervalMs: 0,
    enabled: !!selectedTx,
  })

  const historyQuery = useRealtimeTable({
    key: ['transaction-history', selectedTx?.tx_id],
    queryFn: async (sb) => sb.from('maven_transaction_history').select('*').eq('tx_id', selectedTx?.tx_id).order('fetched_at', { ascending: false }).limit(100),
    intervalMs: 0,
    enabled: !!selectedTx,
  })

  const smsQuery = useRealtimeTable({
    key: ['monitor-sms-links'],
    queryFn: async (sb) => sb.from('inbound_sms').select('id, consumed_by_tx_id, matched_transaction_id, maven_transaction_id, received_at, amount, sender_number, sender_name, receiver_number, device_name, sim_slot, sms_category, balance_after, raw_sms, message, trx_id, trx_reference, match_status, auto_match_score, matched, score, status, review_required, notes').or('consumed_by_tx_id.not.is.null,matched_transaction_id.not.is.null,maven_transaction_id.not.is.null').order('received_at', { ascending: false }).limit(2000),
    intervalMs: autoRefresh ? 15000 : 0,
  })

  const relatedQuery = useRealtimeTable({
    key: ['related-transactions', selectedPhone],
    queryFn: async (sb) => sb.from('maven_transactions').select('tx_id, amount, status, created_utc, modified_utc, updated_at, payment_method, sender_name, sender_number').eq('sender_number', selectedPhone).order('created_utc', { ascending: false }).limit(100),
    intervalMs: autoRefresh ? 15000 : 0,
    enabled: !!selectedPhone,
  })

  const tableTxIds = useMemo(() => [...new Set((table.data || []).map((row) => row.tx_id).filter(Boolean))], [table.data])
  const jobsQuery = useRealtimeTable({
    key: ['monitor-operation-jobs', tableTxIds.join(',')],
    queryFn: async (sb) => tableTxIds.length ? sb.from('browser_jobs').select('tx_id, source, created_at, completed_at, updated_at').in('tx_id', tableTxIds).order('created_at', { ascending: false }).limit(5000) : { data: [], error: null },
    intervalMs: autoRefresh ? 15000 : 0,
    enabled: tableTxIds.length > 0,
  })

  function openTransaction(tx) {
    setSelectedTx(tx)
    setEditAmount(String(tx.amount ?? ''))
  }

  async function logTransactionAction(tx, action, patch = {}) {
    const raw = { action, performed_by: 'Manual', occurred_at: new Date().toISOString(), ...patch }
    const { error } = await supabase.from('maven_transaction_history').insert({ tx_id: tx.tx_id, status: patch.after_status || tx.status, amount: patch.after_amount ?? tx.amount, raw, status_changed: !!patch.after_status && patch.after_status !== tx.status, source: 'dashboard' })
    if (error) showToast(`تم تنفيذ الإجراء لكن تعذر حفظ السجل: ${error.message}`, 'error')
  }

  async function updateTransactionStatus(tx, status) {
    const label = status === 'PAID' ? 'اعتماد' : 'رفض'
    const provider = providerLabel(tx.master_merchant)
    setActionBusy(true)

    let endpoint
    try {
      endpoint = workerEndpointFor(tx.master_merchant)
    } catch (error) {
      setActionBusy(false)
      showToast(error.message, 'error')
      return
    }

    let response
    let payload
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ single_tx: tx.tx_id, single_status: status, allow_reversal: true, manual_paid_reversal_confirmed: true }),
      })
      payload = await response.json().catch(() => ({}))
    } catch (error) {
      setActionBusy(false)
      showToast(`تعذر الاتصال بـ ${provider}: ${error.message}`, 'error')
      return
    }
    if (!response.ok || payload.ok === false) {
      setActionBusy(false)
      showToast(`فشل تحديث ${provider}: ${payload.error || payload.message || `HTTP ${response.status}`}`, 'error')
      return
    }
    await supabase.from('maven_transactions').update({ approved_by: 'Manual' }).eq('tx_id', tx.tx_id)
    await logTransactionAction(tx, status === 'PAID' ? 'approve' : 'decline', { before_status: tx.status, after_status: status })
    setActionBusy(false)
    showToast(`تم ${label} العملية بنجاح`, 'success')
    setSelectedTx(null)
    table.refresh()
    kpis.refresh()
  }

  function requestTransactionStatus(tx, status) {
    setConfirmAction({ tx, status, label: status === 'PAID' ? 'اعتماد' : 'رفض' })
  }

  function requestBlacklist(tx) {
    if (!tx.sender_number) {
      showToast('لا يوجد رقم مرسل لحظره', 'error')
      return
    }
    setConfirmAction({ tx, action: 'blacklist', label: 'حظر الرقم ورفض العملية' })
  }

  async function blacklistAndReject(tx) {
    setActionBusy(true)
    const provider = providerLabel(tx.master_merchant)
    const { error: blacklistError } = await supabase.from('api_risk_blacklist').insert({ type: 'phone', value: tx.sender_number, reason: `حظر تلقائي بعد رفض العملية ${tx.tx_id}` })
    if (blacklistError && !String(blacklistError.message).toLowerCase().includes('duplicate')) {
      setActionBusy(false)
      showToast(`فشل إضافة الرقم للقائمة السوداء: ${blacklistError.message}`, 'error')
      return
    }
    let endpoint
    try {
      endpoint = workerEndpointFor(tx.master_merchant)
    } catch (error) {
      setActionBusy(false)
      showToast(`تم الحظر لكن ${error.message}`, 'error')
      return
    }
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ single_tx: tx.tx_id, single_status: 'DECLINED', allow_reversal: true, manual_paid_reversal_confirmed: true }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.ok === false) throw new Error(payload.error || payload.message || `HTTP ${response.status}`)
      await supabase.from('maven_transactions').update({ approved_by: 'Manual' }).eq('tx_id', tx.tx_id)
      await logTransactionAction(tx, 'blacklist_and_decline', { before_status: tx.status, after_status: 'DECLINED', blacklist_value: tx.sender_number })
      showToast(`تم حظر الرقم ورفض العملية في ${provider}`, 'success')
      setSelectedTx(null)
      table.refresh()
      kpis.refresh()
    } catch (error) {
      showToast(`تم الحظر لكن فشل رفض العملية في ${provider}: ${error.message}`, 'error')
    } finally {
      setActionBusy(false)
    }
  }

  async function saveAmount(tx) {
    const amount = Number(editAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      showToast('أدخل مبلغاً صحيحاً', 'error')
      return
    }
    if (!window.confirm(`حفظ المبلغ الجديد للعملية ${tx.tx_id}؟`)) return
    const provider = providerLabel(tx.master_merchant)
    setActionBusy(true)

    let endpoint
    try {
      endpoint = workerEndpointFor(tx.master_merchant)
    } catch (error) {
      setActionBusy(false)
      showToast(error.message, 'error')
      return
    }

    let response
    let payload
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          single_tx: tx.tx_id,
          single_status: tx.status || 'PENDING',
          single_amount: amount,
          allow_reversal: true,
          manual_paid_reversal_confirmed: true,
        }),
      })
      payload = await response.json().catch(() => ({}))
    } catch (error) {
      setActionBusy(false)
      showToast(`تعذر الاتصال بـ ${provider}: ${error.message}`, 'error')
      return
    }
    setActionBusy(false)
    if (!response.ok || payload.ok === false) {
      showToast(`رفض ${provider} تعديل المبلغ: ${payload.error || payload.message || `HTTP ${response.status}`}`, 'error')
      return
    }
    showToast('تم تعديل المبلغ بنجاح', 'success')
    await logTransactionAction(tx, 'edit_amount', { before_amount: tx.amount, after_amount: amount, after_status: tx.status })
    setSelectedTx(null)
    table.refresh()
    kpis.refresh()
  }

  const stats = useMemo(() => {
    const rows = kpis.data || []
    return {
      total: rows.length,
      totalAmount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      pending: rows.filter((r) => r.status === 'PENDING').length,
      paid: rows.filter((r) => r.status === 'PAID').length,
      declined: rows.filter((r) => r.status === 'DECLINED').length,
    }
  }, [kpis.data])

  const monitorRows = useMemo(() => {
    const smsByTx = new Map()
    for (const sms of smsQuery.data || []) {
      for (const id of [sms.consumed_by_tx_id, sms.matched_transaction_id, sms.maven_transaction_id].filter(Boolean)) {
        if (!smsByTx.has(String(id))) smsByTx.set(String(id), sms)
      }
    }
    const jobByTx = new Map()
    for (const job of jobsQuery.data || []) if (!jobByTx.has(String(job.tx_id))) jobByTx.set(String(job.tx_id), job)
    return (table.data || []).map((row) => ({ ...row, matchedSms: smsByTx.get(String(row.tx_id)) || null, operationJob: jobByTx.get(String(row.tx_id)) || null }))
  }, [table.data, smsQuery.data, jobsQuery.data])

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return monitorRows
    return monitorRows.filter((row) => [row.tx_id, row.sender_number, row.sender_name, row.payment_method, row.merchant, row.status, row.amount].some((value) => String(value ?? '').toLowerCase().includes(query)))
  }, [monitorRows, search])

  const notifications = useMemo(() => monitorRows.filter((row) => row.status === 'PENDING').slice(0, 8).map((row) => ({
    id: row.tx_id,
    title: `عملية معلقة #${row.tx_id}`,
    body: `${formatMoney(row.amount)} · ${operationBy(row, row.operationJob)}`,
  })), [monitorRows])
  const smsNotifications = useMemo(() => (smsQuery.data || []).slice(0, 9).map((sms) => ({ id: sms.id, title: `SMS جديدة #${sms.id}`, body: `${sms.sender_name || 'مرسل غير معروف'} · ${sms.sender_number || 'بدون رقم'} · ${sms.amount || 0}` })), [smsQuery.data])

  useEffect(() => {
    if (table.data) setLastSync(new Date())
  }, [table.data])

  useEffect(() => {
    const requestedTx = searchParams.get('tx')
    if (!requestedTx || !table.data?.length || selectedTx) return
    const tx = table.data.find((row) => String(row.tx_id) === String(requestedTx))
    if (tx) openTransaction(tx)
  }, [searchParams, table.data, selectedTx])

  const columns = [
    { key: 'tx_id', label: 'رقم العملية' },
    { key: 'amount', label: 'المبلغ', render: (r) => formatMoney(r.amount) },
    { key: 'sender_number', label: 'رقم المرسل', render: (r) => r.sender_number ? <button onClick={(e) => { e.stopPropagation(); setSelectedPhone(r.sender_number) }} className="font-mono text-gold underline decoration-gold/30 underline-offset-2 hover:text-gold/80">{r.sender_number}</button> : '—' },
    { key: 'sender_name', label: 'اسم المرسل' },
    { key: 'payment_method', label: 'وسيلة الدفع' },
    { key: 'to_account_number', label: 'حساب الاستلام' },
    { key: 'status', label: 'الحالة', render: (r) => <Badge status={r.status} /> },
    { key: 'approved_by', label: '👤 من وافق', render: (r) => r.approved_by || '—' },
    { key: 'operation_by', label: 'طريقة التنفيذ', render: (r) => <span className={operationBy(r, r.operationJob) === 'AI' ? 'font-semibold text-violet-600' : operationBy(r, r.operationJob) === 'Manual' ? 'font-semibold text-gold' : 'font-semibold text-success'}>{operationBy(r, r.operationJob)}</span> },
    {
      key: 'created_utc',
      label: 'وقت الإنشاء',
      render: (r) => (
        <span title={formatAbsoluteDate(r.created_utc)}><span className="block whitespace-nowrap">{formatAbsoluteDate(r.created_utc)}</span><span className="block text-xs text-muted">{formatRelativeTime(r.created_utc)}</span></span>
      ),
    },
    {
      key: 'modified_utc',
      label: 'آخر تحديث',
      render: (r) => <span title={formatAbsoluteDate(r.modified_utc || r.updated_at)}><span className="block whitespace-nowrap">{formatAbsoluteDate(r.modified_utc || r.updated_at)}</span><span className="block text-xs text-muted">{formatRelativeTime(r.modified_utc || r.updated_at)}</span></span>,
    },
    {
      key: 'sms',
      label: 'SMS',
      render: (r) => r.matchedSms ? <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-success/15 text-lg text-success" title={`Matched SMS · ${r.matchedSms.match_status || 'Confirmed match'}`} aria-label="Matched SMS">📨</span> : <span className="text-muted">—</span>,
    },
    {
      key: 'actions',
      label: 'إجراء',
      render: (r) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {r.status !== 'PAID' && <button disabled={actionBusy} onClick={() => requestTransactionStatus(r, 'PAID')} className="rounded-lg border border-success/40 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/10 disabled:opacity-50">اعتماد</button>}
          {r.status !== 'DECLINED' && <button disabled={actionBusy} onClick={() => requestTransactionStatus(r, 'DECLINED')} className="rounded-lg border border-danger/40 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50">رفض</button>}
          <button disabled={actionBusy} onClick={() => openTransaction(r)} className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:text-text disabled:opacity-50">تعديل</button>
          <button disabled={!r.proof_image_url} onClick={() => r.proof_image_url && setProofUrl(r.proof_image_url)} className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:border-gold/50 hover:text-gold disabled:cursor-not-allowed disabled:opacity-30" title={r.proof_image_url ? 'عرض إثبات الدفع' : 'لا يوجد إثبات'}>🖼️</button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <Topbar
        title="المراقبة"
        subtitle={`عمليات الدفع في الوقت الفعلي${lastSync ? ` · آخر مزامنة ${lastSync.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
        onRefresh={table.refresh}
        isFetching={table.isFetching}
        notifications={notifications}
        smsNotifications={smsNotifications}
        actions={<button onClick={() => setAutoRefresh((enabled) => !enabled)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${autoRefresh ? 'border-success/40 bg-success/10 text-success' : 'border-border bg-card text-muted'}`} title="مزامنة تلقائية كل 15 ثانية">{autoRefresh ? '● مزامنة تلقائية' : '○ المزامنة متوقفة'}</button>}
      />

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="إجمالي اليوم" value={formatNumber(stats.total)} icon="📈" />
          <StatCard label="إجمالي المبالغ" value={formatMoney(stats.totalAmount)} icon="💰" />
          <StatCard label="قيد الانتظار" value={formatNumber(stats.pending)} tone="warning" icon="⏳" />
          <StatCard label="مدفوعة" value={formatNumber(stats.paid)} tone="success" icon="✅" />
          <StatCard label="مرفوضة" value={formatNumber(stats.declined)} tone="danger" icon="⛔" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-colors duration-500">
          <SystemPulse live={autoRefresh} value={autoRefresh ? 'LIVE' : 'PAUSED'} label="Transaction engine" />
          <div className="hidden h-10 w-px bg-border sm:block" />
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4"><div><div className="text-[10px] font-bold uppercase tracking-wider text-muted">Success rate</div><div className="mt-1 text-lg font-extrabold text-success">{stats.total ? Math.round((stats.paid / stats.total) * 100) : 0}%</div></div><div><div className="text-[10px] font-bold uppercase tracking-wider text-muted">Pending queue</div><div className="mt-1 text-lg font-extrabold text-warning">{formatNumber(stats.pending)}</div></div><div><div className="text-[10px] font-bold uppercase tracking-wider text-muted">Last sync</div><div className="mt-1 text-sm font-bold text-text">{lastSync ? lastSync.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</div></div><div><div className="text-[10px] font-bold uppercase tracking-wider text-muted">Mode</div><div className="mt-1 text-sm font-bold text-gold">{autoRefresh ? 'Auto' : 'Manual'}</div></div></div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex min-w-[230px] flex-1 flex-col gap-1">
            <label className="text-xs text-muted">بحث في العمليات</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="TX ID، اسم، محفظة، مبلغ..." className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">الحالة</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter({ status: e.target.value })}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">الكل</option>
              <option value="PENDING">قيد الانتظار</option>
              <option value="PAID">مدفوعة</option>
              <option value="DECLINED">مرفوضة</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">وسيلة الدفع</label>
            <input
              value={filters.payment_method}
              onChange={(e) => updateFilter({ payment_method: e.target.value })}
              placeholder="مثال: VodafoneCash"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">من تاريخ</label>
            <input
              type="datetime-local"
              value={filters.dateFrom}
              onChange={(e) => updateFilter({ dateFrom: e.target.value })}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">إلى تاريخ</label>
            <input
              type="datetime-local"
              value={filters.dateTo}
              onChange={(e) => updateFilter({ dateTo: e.target.value })}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </div>

          <button
            onClick={() => { updateFilter(DEFAULT_FILTERS); setSearch('') }}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text"
          >
            مسح الفلاتر
          </button>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">عدد الصفوف</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              {[50, 100, 250, 500].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        </div>

        <TransactionSmsTable
          transactions={visibleRows}
          smsRows={smsQuery.data || []}
          loading={table.isLoading || smsQuery.isLoading}
          error={table.error || smsQuery.error}
          title="المعاملات الخام + رسائل SMS الخام"
          emptyTitle="لا توجد عمليات مطابقة"
          onTransactionClick={openTransaction}
        />
      </div>

      <Modal open={!!selectedTx} onClose={() => setSelectedTx(null)} title={`تفاصيل العملية ${selectedTx?.tx_id || ''}`}>
        {selectedTx && <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
          <div><div className="text-xs text-muted">رقم العملية</div><div className="mt-1 font-mono text-text">{selectedTx.tx_id || '—'}</div></div>
          <div><div className="text-xs text-muted">المبلغ</div><div className="mt-1 font-bold text-gold">{formatMoney(selectedTx.amount)}</div></div>
          <div><div className="text-xs text-muted">الحالة</div><div className="mt-1"><Badge status={selectedTx.status} /></div></div>
          <div><div className="text-xs text-muted">👤 من وافق</div><div className="mt-1 text-text">{selectedTx.approved_by || '—'}</div></div>
          <div><div className="text-xs text-muted">طريقة التنفيذ</div><div className="mt-1 font-semibold text-gold">{operationBy(selectedTx, selectedTx.operationJob)}</div></div>
          <div><div className="text-xs text-muted">المرسل</div><div className="mt-1 text-text">{selectedTx.sender_name || '—'}</div></div>
          <div><div className="text-xs text-muted">رقم المرسل</div><div className="mt-1 text-text">{selectedTx.sender_number || '—'}</div></div>
          <div><div className="text-xs text-muted">وسيلة الدفع</div><div className="mt-1 text-text">{selectedTx.payment_method || '—'}</div></div>
          <div><div className="text-xs text-muted">حساب الاستلام</div><div className="mt-1 text-text">{selectedTx.to_account_number || '—'}</div></div>
          <div><div className="text-xs text-muted">اسم الحساب</div><div className="mt-1 text-text">{selectedTx.to_account_name || '—'}</div></div>
          <div><div className="text-xs text-muted">البنك</div><div className="mt-1 text-text">{selectedTx.to_bank || '—'}</div></div>
          <div><div className="text-xs text-muted">التاجر الرئيسي</div><div className="mt-1 text-text">{selectedTx.master_merchant || '—'}</div></div>
          <div><div className="text-xs text-muted">التاجر الفرعي</div><div className="mt-1 text-text">{selectedTx.sub_merchant || selectedTx.merchant || '—'}</div></div>
          <div><div className="text-xs text-muted">البوابة</div><div className="mt-1 text-text">{selectedTx.gateway || '—'}</div></div>
          <div><div className="text-xs text-muted">وقت الإنشاء</div><div className="mt-1 text-text">{formatAbsoluteDate(selectedTx.created_utc)}</div></div>
          <div><div className="text-xs text-muted">آخر تحديث</div><div className="mt-1 text-text">{formatAbsoluteDate(selectedTx.modified_utc || selectedTx.updated_at)}</div></div>
          <div className="col-span-2"><div className="text-xs text-muted">رسالة الاستجابة</div><div className="mt-1 break-words text-text">{selectedTx.response_message || '—'}</div></div>
          <div className="col-span-2"><label className="text-xs text-muted">تعديل المبلغ</label><div className="mt-1 flex gap-2"><input type="number" min="0" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text" /><button disabled={actionBusy} onClick={() => saveAmount(selectedTx)} className="rounded-lg bg-gold px-3 py-2 text-sm font-bold text-bg disabled:opacity-50">حفظ</button></div></div>
        </div>}
        {selectedTx?.matchedSms && <div className="mb-4 rounded-xl border border-success/30 bg-success/5 p-4">
          <div className="mb-3 flex items-center justify-between"><h4 className="font-bold text-success">SMS المرتبطة بالعملية</h4><span className="rounded-full bg-success/15 px-2 py-1 text-xs text-success">✓ مطابقة</span></div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted">رقم الرسالة</div><div className="mt-1 text-text">{selectedTx.matchedSms.id}</div></div>
            <div><div className="text-xs text-muted">نوع الرسالة</div><div className="mt-1 text-text">{selectedTx.matchedSms.sms_category || '—'}</div></div>
            <div><div className="text-xs text-muted">وقت الاستلام</div><div className="mt-1 text-text">{formatAbsoluteDate(selectedTx.matchedSms.received_at)}</div></div>
            <div><div className="text-xs text-muted">مبلغ SMS</div><div className="mt-1 font-bold text-success">{formatMoney(selectedTx.matchedSms.amount)}</div></div>
            <div><div className="text-xs text-muted">مرسل SMS</div><div className="mt-1 text-text">{selectedTx.matchedSms.sender_name || selectedTx.matchedSms.sender_number || '—'}</div></div>
            <div><div className="text-xs text-muted">المستلم</div><div className="mt-1 text-text">{selectedTx.matchedSms.receiver_number || '—'}</div></div>
            <div><div className="text-xs text-muted">الجهاز / الشريحة</div><div className="mt-1 text-text">{selectedTx.matchedSms.device_name || '—'} / {selectedTx.matchedSms.sim_slot || '—'}</div></div>
            <div><div className="text-xs text-muted">الرصيد بعد العملية</div><div className="mt-1 text-text">{formatMoney(selectedTx.matchedSms.balance_after)}</div></div>
            <div><div className="text-xs text-muted">حالة المطابقة</div><div className="mt-1 font-semibold text-success">{selectedTx.matchedSms.match_status || (selectedTx.matchedSms.matched ? 'مطابقة مؤكدة' : '—')}</div></div>
            <div><div className="text-xs text-muted">درجة المطابقة</div><div className="mt-1 text-text">{selectedTx.matchedSms.auto_match_score || selectedTx.matchedSms.score || '—'}</div></div>
            <div className="col-span-2"><div className="text-xs text-muted">سبب المطابقة / الموافقة</div><div className="mt-1 rounded-lg bg-card p-3 text-sm text-text">{selectedTx.matchedSms.notes || (selectedTx.matchedSms.amount ? `مطابقة المبلغ ${formatMoney(selectedTx.matchedSms.amount)} مع العملية` : 'تم ربط SMS بالمعاملة عبر رقم العملية')}</div></div>
            <div className="col-span-2"><div className="text-xs text-muted">نص الرسالة</div><div className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-card p-3 text-xs text-text">{selectedTx.matchedSms.raw_sms || selectedTx.matchedSms.message || '—'}</div></div>
          </div>
        </div>}
        {reviewQuery.isLoading ? <div className="text-sm text-muted">جاري التحميل...</div> : reviewQuery.data && reviewQuery.data.length > 0 ? (
          <div className="space-y-3">{reviewQuery.data.map((r, i) => <div key={i} className="rounded-lg border border-border bg-surface p-3"><div className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-muted">قرار المراجعة</div><div className="mt-1 font-semibold text-text">{r.decision || r.target_status || '—'}</div></div><div><div className="text-xs text-muted">درجة المطابقة</div><div className="mt-1 text-text">{r.match_score || '—'}</div></div><div className="col-span-2"><div className="text-xs text-muted">أسباب المطابقة</div><div className="mt-1 text-text">{Array.isArray(r.match_reasons) ? r.match_reasons.join(' · ') : r.match_reasons || r.decision_reason || '—'}</div></div><div className="col-span-2"><div className="text-xs text-muted">سبب القرار</div><div className="mt-1 text-text">{r.decision_reason || '—'}</div></div></div></div>)}</div>
        ) : <div className="text-sm text-muted">لا يوجد سجل في قائمة المراجعة لهذه العملية</div>}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4"><div className="mb-3 flex items-center justify-between"><h4 className="font-bold text-text">سجل إجراءات المعاملة</h4><span className="text-xs text-muted">{historyQuery.data?.length || 0} إجراء</span></div>{historyQuery.isLoading ? <div className="text-sm text-muted">جاري تحميل السجل...</div> : historyQuery.data?.length ? <div className="space-y-2">{historyQuery.data.map((event) => <div key={event.id} className="rounded-lg border border-border bg-card p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-gold">{event.raw?.action || 'sync'}</span><span className="text-xs text-muted">{formatAbsoluteDate(event.fetched_at)}</span></div><div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted"><span>المنفذ: {event.raw?.performed_by || event.source || '—'}</span><span>الحالة: {event.status || '—'}</span><span>المبلغ: {formatMoney(event.amount)}</span><span>UTC: {event.fetched_at ? new Date(event.fetched_at).toISOString().replace('T', ' ').replace('Z', '') : '—'}</span></div></div>)}</div> : <div className="text-sm text-muted">لا يوجد سجل إجراءات لهذه المعاملة</div>}</div>
        {selectedTx && <div className="mt-5 flex flex-wrap justify-end gap-2"><button disabled={actionBusy || selectedTx.status === 'PAID'} onClick={() => requestTransactionStatus(selectedTx, 'PAID')} className="rounded-lg bg-success px-3 py-2 text-sm font-bold text-white disabled:opacity-50">اعتماد</button><button disabled={actionBusy || selectedTx.status === 'DECLINED'} onClick={() => requestTransactionStatus(selectedTx, 'DECLINED')} className="rounded-lg bg-danger px-3 py-2 text-sm font-bold text-white disabled:opacity-50">رفض</button><button disabled={actionBusy} onClick={() => requestBlacklist(selectedTx)} className="rounded-lg border border-danger/40 px-3 py-2 text-sm font-bold text-danger hover:bg-danger/10 disabled:opacity-50">🚫 حظر ورفض تلقائي</button><button onClick={() => setSelectedTx(null)} className="rounded-lg bg-gold px-3 py-2 text-sm font-bold text-bg">إغلاق</button></div>}
      </Modal>

      <Modal open={!!confirmAction} onClose={() => !actionBusy && setConfirmAction(null)} title="تأكيد الإجراء" width="max-w-md">
        {confirmAction && <div className="space-y-5">
          <div className={`rounded-xl border p-4 ${confirmAction.action === 'blacklist' || confirmAction.status !== 'PAID' ? 'border-danger/30 bg-danger/10' : 'border-success/30 bg-success/10'}`}>
            <div className="text-sm text-muted">هل تريد {confirmAction.label}؟</div>
            <div className="mt-2 font-mono text-xl font-bold text-text">#{confirmAction.tx.tx_id}</div>
            <div className="mt-1 text-sm text-text">المبلغ: <span className="font-bold text-gold">{formatMoney(confirmAction.tx.amount)}</span></div>
          </div>
          <div className="flex justify-end gap-2"><button disabled={actionBusy} onClick={() => setConfirmAction(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted">إلغاء</button><button disabled={actionBusy} onClick={async () => { const action = confirmAction; setConfirmAction(null); if (action.action === 'blacklist') await blacklistAndReject(action.tx); else await updateTransactionStatus(action.tx, action.status) }} className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${confirmAction.action === 'blacklist' || confirmAction.status !== 'PAID' ? 'bg-danger' : 'bg-success'}`}>{actionBusy ? 'جارٍ التنفيذ...' : `تأكيد ${confirmAction.label}`}</button></div>
        </div>}
      </Modal>

      <Modal open={!!proofUrl} onClose={() => setProofUrl(null)} title="إثبات الدفع" width="max-w-3xl">
        {proofUrl ? <img src={proofUrl} alt="إثبات الدفع" className="max-h-[70vh] w-full rounded-xl object-contain" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <div className="p-8 text-center text-sm text-muted">لا يوجد إثبات مرفق</div>}
      </Modal>

      <Modal open={!!selectedPhone} onClose={() => setSelectedPhone(null)} title={`عمليات العميل ${selectedPhone || ''}`} width="max-w-4xl">
        {relatedQuery.isLoading ? <div className="p-6 text-sm text-muted">جاري تحميل العمليات المرتبطة...</div> : relatedQuery.error ? <div className="p-6 text-sm text-danger">تعذر تحميل العمليات المرتبطة: {String(relatedQuery.error.message || relatedQuery.error)}</div> : relatedQuery.data?.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-right text-xs text-muted"><th className="px-3 py-3">رقم العملية</th><th className="px-3 py-3">المبلغ</th><th className="px-3 py-3">الحالة</th><th className="px-3 py-3">وسيلة الدفع</th><th className="px-3 py-3">وقت الإنشاء</th></tr></thead><tbody>{relatedQuery.data.map((tx) => <tr key={tx.tx_id} className="border-b border-border last:border-0"><td className="px-3 py-3 font-mono text-gold">{tx.tx_id}</td><td className="px-3 py-3 font-bold">{formatMoney(tx.amount)}</td><td className="px-3 py-3"><Badge status={tx.status} /></td><td className="px-3 py-3">{tx.payment_method || '—'}</td><td className="px-3 py-3 text-xs text-muted">{formatAbsoluteDate(tx.created_utc)}</td></tr>)}</tbody></table></div> : <div className="p-6 text-center text-sm text-muted">لا توجد عمليات مرتبطة بهذا الرقم</div>}
      </Modal>
    </div>
  )
}
