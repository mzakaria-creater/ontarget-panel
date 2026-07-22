import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { supabase } from '../lib/supabase'
import { loadFilters, saveFilters } from '../utils/storage'
import { formatMoney, formatNumber, formatRelativeTime, formatAbsoluteDate } from '../utils/format'
import Topbar from '../components/Topbar'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { dedupeSms } from '../utils/smsDedupe'

const PAGE_KEY = 'smslive'
const DEFAULT_FILTERS = { device_name: '', sms_category: '', provider: '', search: '', date_from: '', date_to: '' }
const DEVICES = ['ont1', 'ont2', 'ont3', 'ont4', 'ont5', 'ont6']

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1]
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue }
    if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ''; continue }
    cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const csvValue = (row, headers, name) => row[headers.indexOf(name)]?.trim() || ''

const CATEGORY_STYLES = {
  deposit: 'text-success',
  withdrawal: 'text-danger',
}

function operationBy(tx) {
  const raw = tx?.raw && typeof tx.raw === 'object' ? tx.raw : tx?.maven_raw_row && typeof tx.maven_raw_row === 'object' ? tx.maven_raw_row : {}
  const explicit = tx?.operation_by || raw.operation_by || raw.operationBy || raw.approval_source || raw.source
  const value = String(explicit || '').toLowerCase()
  if (value.includes('ai') || value.includes('auto') || value.includes('bot')) return 'AI'
  if (value.includes('manual') || value.includes('operator') || value.includes('user')) return 'Manual'
  if (tx?.approved_by) return 'Manual'
  return 'Maven'
}

const JOB_STATE_LABELS = { pending: 'قيد الانتظار', locked: 'قيد التنفيذ', completed: 'مكتمل', failed: 'فشل' }

const TRACE_TONES = {
  success: { dot: 'bg-success text-white', text: 'text-success', line: 'bg-success/40' },
  warning: { dot: 'bg-gold text-bg', text: 'text-gold', line: 'bg-gold/40' },
  danger: { dot: 'bg-danger text-white', text: 'text-danger', line: 'bg-danger/40' },
  muted: { dot: 'border border-border bg-surface text-muted', text: 'text-muted', line: 'bg-border' },
}

function TraceStep({ icon, label, tone = 'muted', time, children, last = false }) {
  const t = TRACE_TONES[tone] || TRACE_TONES.muted
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${t.dot}`}>{icon}</div>
        {!last && <div className={`mt-1 w-0.5 flex-1 ${t.line}`} />}
      </div>
      <div className={`flex-1 ${last ? '' : 'pb-5'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`text-sm font-bold ${t.text}`}>{label}</div>
          {time && <div className="text-xs text-muted">{time}</div>}
        </div>
        <div className="mt-1 text-sm leading-6 text-text">{children}</div>
      </div>
    </div>
  )
}

export default function SmsLive() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [filters, setFilters] = useState(() => loadFilters(PAGE_KEY, DEFAULT_FILTERS))
  const [selectedSms, setSelectedSms] = useState(null)
  const [rawDraft, setRawDraft] = useState('')
  const [linkTxId, setLinkTxId] = useState('')
  const [linkingTx, setLinkingTx] = useState(false)
  const [savingRaw, setSavingRaw] = useState(false)
  const [freshIds, setFreshIds] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const knownIds = useRef(null)

  const updateFilter = (patch) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    saveFilters(PAGE_KEY, next)
  }

  async function importCsv(file) {
    if (!file) return
    setImporting(true)
    try {
      const records = parseCsv(await file.text())
      const headerIndex = records.findIndex((row) => row.includes('ID') && row.includes('تاريخ ووقت الاستلام'))
      if (headerIndex < 0) throw new Error('لم يتم العثور على صف عناوين CSV الصحيح')
      const headers = records[headerIndex]
      const existingKeys = new Set((table.data || []).map((row) => `${row.received_at}|${row.sender_number}|${row.amount}|${row.sender_name}`))
      const payload = records.slice(headerIndex + 1).map((row) => {
        const received = csvValue(row, headers, 'تاريخ ووقت الاستلام'); const amount = Number(csvValue(row, headers, 'المبلغ (ج)'))
        const senderNumber = csvValue(row, headers, 'رقم المُرسِل'); const senderName = csvValue(row, headers, 'اسم المُرسِل')
        const raw = csvValue(row, headers, 'النص الخام الكامل'); const key = `${received}|${senderNumber}|${amount}|${senderName}`
        return { key, row: { sender: csvValue(row, headers, 'رقم المُرسِل'), sender_number: senderNumber || null, sender_name: senderName || null, amount: Number.isFinite(amount) ? amount : null, balance_after: Number(csvValue(row, headers, 'الرصيد بعدها (ج)')) || null, provider: csvValue(row, headers, 'المزوّد') || 'orange-cash', sms_category: 'deposit', received_at: received ? new Date(received).toISOString() : null, created_at: received ? new Date(received).toISOString() : null, raw_sms: raw || null, message: raw || null, trx_reference: csvValue(row, headers, 'رقم معاملة Orange') || null, device_name: csvValue(row, headers, 'الجهاز') || null, matched: csvValue(row, headers, 'استُخدمت لمعاملة؟') === 'نعم', review_required: csvValue(row, headers, 'الحالة (موثوقة؟)') !== 'موثوقة' } }
      }).filter(({ row }) => row.received_at && row.amount != null)
      const fresh = payload.filter(({ key }) => !existingKeys.has(key)).map(({ row }) => row)
      if (!fresh.length) { showToast('كل سجلات CSV موجودة بالفعل أو غير صالحة', 'success'); return }
      if (!window.confirm(`استيراد ${fresh.length} رسالة SMS إلى جدول الرسائل؟`)) return
      for (let index = 0; index < fresh.length; index += 100) {
        const { error } = await supabase.from('inbound_sms').insert(fresh.slice(index, index + 100))
        if (error) throw error
      }
      showToast(`تم استيراد ${fresh.length} رسالة SMS`, 'success'); table.refresh()
    } catch (error) { showToast(`فشل استيراد CSV: ${error.message}`, 'error') } finally { setImporting(false) }
  }

  const table = useRealtimeTable({
    key: ['smslive-table', filters],
    queryFn: async (sb) => {
      let query = sb.from('inbound_sms').select('id, sender, message, wallet, amount, trx_reference, provider, matched, suspicious, score, status, processed_at, created_at, merchant_name, sub_merchant_name, client_name, wallet_name, receiver_number, sender_number, sender_name, balance_after, trx_id, sms_first_line, sms_category, matched_transaction_id, match_status, auto_match_score, review_required, assigned_operator, raw_sms, device_name, sim_slot, received_at, maven_transaction_id, maven_status_sent, consumed_by_tx_id, confirmed_wallet_number').order('received_at', { ascending: false, nullsFirst: false }).limit(5000)
      if (filters.device_name) query = query.eq('device_name', filters.device_name)
      if (filters.sms_category) query = query.eq('sms_category', filters.sms_category)
      if (filters.provider) query = query.ilike('provider', `%${filters.provider}%`)
      if (filters.date_from) query = query.gte('received_at', `${filters.date_from}T00:00:00`)
      if (filters.date_to) {
        const end = new Date(`${filters.date_to}T00:00:00`)
        end.setDate(end.getDate() + 1)
        query = query.lt('received_at', end.toISOString())
      }
      return query
    },
    intervalMs: 5000,
  })

  useEffect(() => {
    if (!table.data) return
    const currentIds = new Set(table.data.map((r) => r.id))

    if (knownIds.current === null) {
      knownIds.current = currentIds
      return
    }

    const newlyArrived = table.data.filter((r) => !knownIds.current.has(r.id)).map((r) => r.id)
    knownIds.current = currentIds

    if (newlyArrived.length > 0) {
      setFreshIds((prev) => new Set([...prev, ...newlyArrived]))
      const timer = setTimeout(() => {
        setFreshIds((prev) => {
          const next = new Set(prev)
          newlyArrived.forEach((id) => next.delete(id))
          return next
        })
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [table.data])

  const smsRows = useMemo(() => {
    const term = filters.search.trim().toLowerCase()
    const sorted = dedupeSms(table.data || [])
      .filter((row) => !term || [row.message, row.raw_sms, row.sender, row.sender_number, row.receiver_number, row.trx_id, row.trx_reference, row.maven_transaction_id, row.consumed_by_tx_id, row.device_name].some((value) => String(value ?? '').toLowerCase().includes(term)))
      .sort((a, b) => new Date(b.received_at || b.created_at || 0).getTime() - new Date(a.received_at || a.created_at || 0).getTime())
    const firstDepositByCustomer = new Set()
    const seenCustomers = new Set()
    for (const row of [...sorted].reverse()) {
      if (row.sms_category !== 'deposit') continue
      const customer = row.sender_number || row.sender || row.client_id || row.sender_name || `sms-${row.id}`
      if (!seenCustomers.has(String(customer))) {
        seenCustomers.add(String(customer))
        firstDepositByCustomer.add(String(row.id))
      }
    }
    return sorted.map((row) => ({ ...row, deposit_type: row.sms_category === 'deposit' ? (firstDepositByCustomer.has(String(row.id)) ? 'first' : 'retention') : null }))
  }, [table.data, filters.search])
  const linkedTxIds = useMemo(() => [...new Set((table.data || []).flatMap((row) => [row.consumed_by_tx_id, row.matched_transaction_id, row.maven_transaction_id].filter((value) => /^\d+$/.test(String(value ?? ''))).map(String)))], [table.data])
  const linkedTransactions = useRealtimeTable({
    key: ['smslive-linked-transactions', linkedTxIds.join(',')],
    queryFn: async (sb) => {
      if (!linkedTxIds.length) return { data: [], error: null }
      return sb.from('maven_transactions').select('tx_id, status, amount, approved_by, created_utc, modified_utc, updated_at, sender_name, sender_number, payment_method, merchant, sub_merchant, proof_image_url, raw, maven_raw_row').in('tx_id', linkedTxIds).limit(5000)
    },
    intervalMs: 5000,
    enabled: linkedTxIds.length > 0,
  })
  const transactionById = useMemo(() => new Map((linkedTransactions.data || []).map((tx) => [String(tx.tx_id), tx])), [linkedTransactions.data])
  const selectedLinkedTxId = selectedSms ? (selectedSms.consumed_by_tx_id || selectedSms.matched_transaction_id || selectedSms.maven_transaction_id) : null
  const reviewQuery = useRealtimeTable({
    key: ['smslive-review-queue', selectedLinkedTxId],
    queryFn: async (sb) => sb.from('review_queue').select('*').eq('tx_id', selectedLinkedTxId).order('created_at', { ascending: false }),
    intervalMs: 0,
    enabled: !!selectedLinkedTxId,
  })
  const jobsQuery = useRealtimeTable({
    key: ['smslive-browser-jobs', selectedLinkedTxId],
    queryFn: async (sb) => sb.from('browser_jobs').select('id, tx_id, source, target_status, state, created_at, completed_at, maven_before_status, maven_after_status, last_error').eq('tx_id', selectedLinkedTxId).order('created_at', { ascending: false }),
    intervalMs: 0,
    enabled: !!selectedLinkedTxId,
  })
  const candidateQuery = useRealtimeTable({
    key: ['smslive-candidate-tx', selectedSms?.id, selectedSms?.amount],
    queryFn: async (sb) => sb.from('maven_transactions').select('tx_id, amount, status, created_utc, sender_name, sender_number, to_account_number').eq('status', 'PENDING').eq('amount', selectedSms?.amount).order('created_utc', { ascending: false }).limit(20),
    intervalMs: 0,
    enabled: !!selectedSms && !selectedLinkedTxId && !!selectedSms.amount,
  })
  const providers = useMemo(() => [...new Set((table.data || []).map((row) => row.provider).filter(Boolean))].sort(), [table.data])
  const devices = useMemo(() => [...new Set([...DEVICES, ...(table.data || []).map((row) => row.device_name).filter(Boolean)])].sort(), [table.data])
  const latestSms = smsRows[0] || null
  const deposits = smsRows.filter((row) => row.sms_category === 'deposit').length
  const withdrawals = smsRows.filter((row) => row.sms_category === 'withdrawal').length
  const firstDeposits = smsRows.filter((row) => row.deposit_type === 'first').length
  const retentionDeposits = smsRows.filter((row) => row.deposit_type === 'retention').length

  const openSms = (row) => {
    setSelectedSms(row)
    setRawDraft(row?.raw_sms || row?.message || '')
    setLinkTxId('')
  }

  const manuallyLinkTransaction = async () => {
    if (!selectedSms || selectedSms.consumed_by_tx_id || selectedSms.matched_transaction_id || selectedSms.maven_transaction_id) return
    const txId = Number(linkTxId.trim())
    if (!Number.isSafeInteger(txId) || txId <= 0) {
      window.alert('أدخل رقم معاملة Maven صحيحاً')
      return
    }

    setLinkingTx(true)
    const { data: tx, error: txError } = await supabase.from('maven_transactions').select('tx_id').eq('tx_id', txId).maybeSingle()
    if (txError || !tx) {
      setLinkingTx(false)
      window.alert(txError?.message || `لم يتم العثور على المعاملة ${txId}`)
      return
    }

    const note = `Manual DMD link to Maven transaction ${txId}`
    const { error } = await supabase.from('inbound_sms').update({
      matched_transaction_id: txId,
      maven_transaction_id: txId,
      matched: true,
      match_status: 'manual',
      review_required: false,
      notes: note,
    }).eq('id', selectedSms.id)
    setLinkingTx(false)
    if (error) {
      window.alert(`تعذر ربط الرسالة بالمعاملة: ${error.message}`)
      return
    }

    setSelectedSms({ ...selectedSms, matched_transaction_id: txId, maven_transaction_id: txId, matched: true, match_status: 'manual', review_required: false, notes: note })
    setLinkTxId('')
    table.refresh()
    linkedTransactions.refresh()
  }

  const saveRawSms = async () => {
    if (!selectedSms) return
    setSavingRaw(true)
    const { error } = await supabase.from('inbound_sms').update({ raw_sms: rawDraft }).eq('id', selectedSms.id)
    setSavingRaw(false)
    if (error) {
      window.alert(`تعذر حفظ النص الخام: ${error.message}`)
      return
    }
    setSelectedSms({ ...selectedSms, raw_sms: rawDraft })
    const linkedTxId = selectedSms.consumed_by_tx_id || selectedSms.matched_transaction_id || selectedSms.maven_transaction_id
    if (linkedTxId) await supabase.from('maven_transaction_history').insert({ tx_id: linkedTxId, status: transactionById.get(String(linkedTxId))?.status || '—', amount: transactionById.get(String(linkedTxId))?.amount || selectedSms.amount, raw: { action: 'edit_sms_raw', sms_id: selectedSms.id, performed_by: 'Manual', occurred_at: new Date().toISOString() }, status_changed: false, source: 'dashboard' })
    table.refresh()
  }

  const columns = [
    { key: 'id', label: '#' },
    {
      key: 'received_at',
      label: 'الوقت',
      render: (r) => <span title={formatAbsoluteDate(r.received_at || r.created_at)}>{formatAbsoluteDate(r.received_at || r.created_at)}</span>,
    },
    {
      key: 'sms_category',
      label: 'النوع',
      render: (r) => (
        <span className={`font-semibold ${CATEGORY_STYLES[r.sms_category] || 'text-muted'}`}>
          {r.sms_category === 'deposit' ? 'إيداع' : r.sms_category === 'withdrawal' ? 'سحب' : r.sms_category}
        </span>
      ),
    },
    { key: 'deposit_type', label: 'تصنيف الإيداع', render: (r) => r.deposit_type === 'first' ? <span className="font-semibold text-gold">إيداع أول</span> : r.deposit_type === 'retention' ? <span className="font-semibold text-violet-600">إيداع احتفاظ</span> : '—' },
    { key: 'device_name', label: 'الجهاز' },
    { key: 'sim_slot', label: 'الشريحة' },
    { key: 'sms_amount', label: 'المبلغ', render: (r) => <span className="font-semibold text-gold">{formatMoney(r.amount)}</span> },
    { key: 'sms_sender_name', label: 'اسم المرسل', render: (r) => r.sender_name || '—' },
    { key: 'sms_sender_number', label: 'رقم الهاتف', render: (r) => r.sender_number || '—' },
    { key: 'counterparty', label: 'من/إلى', render: (r) => <span title={`${r.sender_name || ''} ${r.sender_number || ''}`}>{r.sender_name || r.sender_number || r.receiver_number || r.sender || '—'}</span> },
    { key: 'receiving_wallet', label: '🏦 محفظة الاستقبال', render: (r) => r.confirmed_wallet_number || r.wallet_name || r.wallet || '—' },
    { key: 'transaction_reference', label: 'رقم العملية', render: (r) => r.trx_id || r.trx_reference || r.maven_transaction_id || r.consumed_by_tx_id || '—' },
    { key: 'message', label: 'نص الرسالة', render: (r) => <span className="block max-w-[320px] truncate" title={r.message || r.raw_sms || r.sms_first_line}>{r.message || r.raw_sms || r.sms_first_line || '—'}</span> },
    { key: 'balance_after', label: 'الرصيد بعدها', render: (r) => formatMoney(r.balance_after) },
    {
      key: 'consumed_by_tx_id',
      label: 'معاملة مرتبطة',
      render: (r) => {
        const id = r.consumed_by_tx_id || r.matched_transaction_id || r.maven_transaction_id
        const tx = id ? transactionById.get(String(id)) : null
        return id ? <button onClick={(event) => { event.stopPropagation(); navigate(`/monitor?tx=${encodeURIComponent(id)}`) }} className={`underline decoration-dotted underline-offset-2 hover:text-gold ${tx ? 'font-semibold text-success' : 'text-gold'}`}>{tx?.status ? `${id} · ${tx.status}` : id}</button> : <span className="text-muted">غير مرتبطة</span>
      },
    },
    { key: 'approved_by', label: '👤 من وافق', render: (r) => {
      const id = r.consumed_by_tx_id || r.matched_transaction_id || r.maven_transaction_id
      return transactionById.get(String(id))?.approved_by || <span className="text-muted">—</span>
    } },
    { key: 'operation_by', label: 'طريقة التنفيذ', render: (r) => {
      const id = r.consumed_by_tx_id || r.matched_transaction_id || r.maven_transaction_id
      const tx = transactionById.get(String(id))
      const value = operationBy(tx)
      return <span className={value === 'AI' ? 'font-semibold text-violet-600' : value === 'Manual' ? 'font-semibold text-gold' : 'font-semibold text-success'}>{value}</span>
    } },
  ]

  return (
    <div className="flex h-full flex-col bg-bg">
      <Topbar title="SMS Live" subtitle={`${formatNumber(smsRows.length)} رسالة SMS — الأحدث أولاً · تحديث كل 5 ثواني`} smsNotifications={smsRows.slice(0, 9).map((sms) => ({ id: sms.id, title: `SMS #${sms.id} · ${sms.sender_name || 'مرسل غير معروف'}`, body: `${sms.sender_number || 'بدون رقم'} · ${formatMoney(sms.amount)} · ${sms.device_name || 'بدون جهاز'}` }))} onRefresh={table.refresh} isFetching={table.isFetching} />

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <div className="rounded-2xl border border-border bg-card p-4"><div className="text-xs text-muted">كل رسائل SMS — جدول شامل</div><div className="mt-2 text-2xl font-bold text-text">{formatNumber(smsRows.length)}</div><div className="mt-1 text-xs text-muted">تحديث كل 5 ثواني</div></div>
          <div className="rounded-2xl border border-border bg-card p-4"><div className="text-xs text-muted">إيداعات</div><div className="mt-2 text-2xl font-bold text-success">{formatNumber(deposits)}</div><div className="mt-1 text-xs text-muted">رسائل واردة</div></div>
          <div className="rounded-2xl border border-border bg-card p-4"><div className="text-xs text-muted">سحوبات</div><div className="mt-2 text-2xl font-bold text-danger">{formatNumber(withdrawals)}</div><div className="mt-1 text-xs text-muted">رسائل واردة</div></div>
          <div className="rounded-2xl border border-border bg-card p-4"><div className="text-xs text-muted">إيداع أول</div><div className="mt-2 text-2xl font-bold text-gold">{formatNumber(firstDeposits)}</div><div className="mt-1 text-xs text-muted">أول إيداع للعميل</div></div>
          <div className="rounded-2xl border border-border bg-card p-4"><div className="text-xs text-muted">إيداع احتفاظ</div><div className="mt-2 text-2xl font-bold text-violet-600">{formatNumber(retentionDeposits)}</div><div className="mt-1 text-xs text-muted">إيداعات لاحقة</div></div>
          <div className="rounded-2xl border border-border bg-card p-4"><div className="text-xs text-muted">آخر وصول</div><div className="mt-2 text-sm font-bold text-gold">{latestSms ? formatAbsoluteDate(latestSms.received_at) : '—'}</div><div className="mt-1 text-xs text-muted">{latestSms ? formatRelativeTime(latestSms.received_at) : 'بانتظار البيانات'}</div></div>
        </div>

        {latestSms && <button onClick={() => openSms(latestSms)} className="w-full rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/10 via-card to-card p-5 text-left transition hover:border-gold/60">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-xl">📨</span><div><div className="text-xs font-bold uppercase tracking-wider text-gold">آخر رسالة مستلمة</div><div className="mt-1 text-sm font-bold text-text">#{latestSms.id} · {formatAbsoluteDate(latestSms.received_at)}</div></div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${latestSms.sms_category === 'withdrawal' ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'}`}>{latestSms.sms_category === 'withdrawal' ? 'سحب' : 'إيداع'}</span></div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5"><div><div className="text-xs text-muted">المبلغ</div><div className="mt-1 font-bold text-gold">{formatMoney(latestSms.amount)}</div></div><div><div className="text-xs text-muted">المرسل</div><div className="mt-1 text-text">{latestSms.sender_name || latestSms.sender_number || '—'}</div></div><div><div className="text-xs text-muted">الجهاز</div><div className="mt-1 text-text">{latestSms.device_name || '—'}</div></div><div><div className="text-xs text-muted">الشريحة</div><div className="mt-1 text-text">{latestSms.sim_slot || '—'}</div></div><div><div className="text-xs text-muted">الربط</div><div className="mt-1 text-text">{latestSms.consumed_by_tx_id || 'غير مرتبطة'}</div></div></div>
        </button>}

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">الجهاز</label>
            <select
              value={filters.device_name}
              onChange={(e) => updateFilter({ device_name: e.target.value })}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">الكل</option>
              {devices.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <label className="text-xs text-muted">بحث بالنص، الرقم، رقم العملية...</label>
            <input value={filters.search} onChange={(e) => updateFilter({ search: e.target.value })} placeholder="بحث بالنص، الرقم، رقم العملية..." className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">النوع</label>
            <select
              value={filters.sms_category}
              onChange={(e) => updateFilter({ sms_category: e.target.value })}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="">الكل</option>
              <option value="deposit">إيداع</option>
              <option value="withdrawal">سحب</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">مزود الخدمة</label>
            <select value={filters.provider} onChange={(e) => updateFilter({ provider: e.target.value })} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text">
              <option value="">🏦 كل المزوّدين</option>
              {providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">من</label>
            <input type="date" value={filters.date_from} onChange={(e) => updateFilter({ date_from: e.target.value })} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">إلى</label>
            <input type="date" value={filters.date_to} onChange={(e) => updateFilter({ date_to: e.target.value })} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" />
          </div>

          <button
            onClick={() => updateFilter(DEFAULT_FILTERS)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text"
          >
            مسح الفلاتر
          </button>
          <label className={`cursor-pointer rounded-lg border border-gold/40 px-3 py-2 text-sm font-bold text-gold hover:bg-gold/10 ${importing ? 'pointer-events-none opacity-50' : ''}`}>
            {importing ? 'جارٍ الاستيراد...' : '⬆ استيراد CSV إلى نفس الجدول'}
            <input type="file" accept=".csv,text/csv" className="hidden" disabled={importing} onChange={(event) => { importCsv(event.target.files?.[0]); event.target.value = '' }} />
          </label>
        </div>

        <DataTable
          columns={columns}
          data={smsRows}
          loading={table.isLoading}
          error={table.error}
          onRowClick={openSms}
          rowClassName={(row) => (freshIds.has(row.id) ? 'animate-flash-gold' : '')}
          emptyEmoji="📨"
          emptyTitle="لا توجد رسائل"
          emptySubtitle="بانتظار وصول رسائل SMS جديدة"
        />
      </div>

      <Modal open={!!selectedSms} onClose={() => setSelectedSms(null)} title={`تفاصيل SMS #${selectedSms?.id || ''}`}>
        {selectedSms && (() => {
          const linkedId = selectedSms.consumed_by_tx_id || selectedSms.matched_transaction_id || selectedSms.maven_transaction_id
          const tx = linkedId ? transactionById.get(String(linkedId)) : null
          const details = [
            ['الجهاز', selectedSms.device_name],
            ['النوع', selectedSms.sms_category === 'deposit' ? (selectedSms.deposit_type === 'first' ? 'إيداع أول' : 'إيداع احتفاظ') : selectedSms.sms_category === 'withdrawal' ? 'سحب' : selectedSms.sms_category],
            ['المبلغ', formatMoney(selectedSms.amount)],
            ['من/إلى', selectedSms.sender_name || selectedSms.sender_number || selectedSms.receiver_number],
            ['محفظة الاستقبال', selectedSms.confirmed_wallet_number || selectedSms.wallet_name || selectedSms.wallet],
            ['رقم العملية', selectedSms.trx_id || selectedSms.trx_reference || selectedSms.maven_transaction_id],
            ['معاملة مرتبطة', linkedId],
            ['حالة المعاملة', tx?.status],
            ['من وافق', tx?.approved_by],
            ['طريقة التنفيذ', operationBy(tx)],
            ['وقت SMS', formatAbsoluteDate(selectedSms.received_at || selectedSms.created_at)],
            ['الرصيد بعدها', formatMoney(selectedSms.balance_after)],
          ]
          const matchScore = selectedSms.auto_match_score ?? selectedSms.score
          const isMatched = selectedSms.matched === true || selectedSms.match_status === 'matched' || selectedSms.match_status === 'manual'
          const matchTone = isMatched ? 'success' : selectedSms.review_required ? 'warning' : matchScore != null ? 'warning' : 'muted'
          const matchLabel = isMatched ? (selectedSms.match_status === 'manual' ? 'مطابقة يدوية' : 'مطابقة تلقائية') : selectedSms.review_required ? 'بانتظار المراجعة' : 'غير مطابقة'
          const sameAsOurWallet = !!selectedSms.sender_number && [selectedSms.confirmed_wallet_number, selectedSms.wallet, selectedSms.receiver_number].some((v) => v && String(v) === String(selectedSms.sender_number))

          const jobs = jobsQuery.data || []
          const latestJob = jobs[0]
          const automationTone = !jobs.length ? 'muted' : latestJob.state === 'completed' ? 'success' : latestJob.state === 'failed' ? 'danger' : 'warning'

          const reviews = reviewQuery.data || []
          const latestReview = reviews[0]
          const reviewDecision = latestReview?.decision || latestReview?.target_status
          const reviewTone = !reviews.length ? 'muted' : /approve|paid|confirm/i.test(reviewDecision || '') ? 'success' : /declin|reject/i.test(reviewDecision || '') ? 'danger' : 'warning'

          const reportTone = tx?.status === 'PAID' ? 'success' : tx?.status === 'DECLINED' ? 'danger' : tx ? 'warning' : 'muted'
          const reportIcon = tx?.status === 'PAID' ? '✔' : tx?.status === 'DECLINED' ? '✕' : '…'

          const smsTime = new Date(selectedSms.received_at || selectedSms.created_at || 0).getTime()
          const recommendedCandidates = [...(candidateQuery.data || [])]
            .map((c) => ({ ...c, diffMs: Math.abs(new Date(c.created_utc).getTime() - smsTime) }))
            .sort((a, b) => a.diffMs - b.diffMs)
          const recommendedTx = recommendedCandidates[0]
          const recommendedIsSameWallet = !!recommendedTx?.sender_number && recommendedTx.sender_number === recommendedTx.to_account_number

          return <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">مسار المعاملة — من الاستلام حتى التقرير</div>
              <TraceStep icon="1" label="استلام SMS" tone="success" time={formatAbsoluteDate(selectedSms.received_at || selectedSms.created_at)}>
                {selectedSms.device_name || '—'} · شريحة {selectedSms.sim_slot || '—'} · {formatMoney(selectedSms.amount)} من {selectedSms.sender_name || selectedSms.sender_number || '—'}
              </TraceStep>
              <TraceStep icon="2" label="قرار المطابقة" tone={matchTone}>
                {matchLabel}{matchScore != null ? ` · الدرجة ${matchScore}` : ''}
                {sameAsOurWallet && <div className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger">⚠ الرقم المُطابَق هو رقم محفظتنا وليس رقم العميل — يحتاج مراجعة يدوية</div>}
              </TraceStep>
              <TraceStep icon="3" label="الأتمتة" tone={automationTone}>
                {jobs.length
                  ? jobs.map((j) => <div key={j.id}>{j.source || 'automation'} → {j.target_status || '—'} ({JOB_STATE_LABELS[j.state] || j.state || '—'}){j.last_error ? ` · ${j.last_error}` : ''}</div>)
                  : 'لا يوجد إجراء آلي مسجل لهذه المعاملة'}
              </TraceStep>
              <TraceStep icon="4" label="المراجعة" tone={reviewTone}>
                {reviews.length
                  ? reviews.map((r, i) => <div key={i}>{r.decision || r.target_status || '—'}{r.match_score != null ? ` · درجة ${r.match_score}` : ''}{r.decision_reason ? ` · ${r.decision_reason}` : ''}</div>)
                  : 'لم تدخل هذه المعاملة قائمة المراجعة'}
              </TraceStep>
              <TraceStep icon={reportIcon} label="التقرير النهائي" tone={reportTone} last>
                {tx ? `${tx.status} · ${operationBy(tx)}${tx.approved_by ? ' · ' + tx.approved_by : ''}` : 'بانتظار قرار نهائي على المعاملة'}
              </TraceStep>
            </div>
            {tx?.proof_image_url && <div className="rounded-xl border border-border bg-surface p-3"><div className="mb-2 text-xs font-semibold text-muted">إثبات المعاملة</div><a href={tx.proof_image_url} target="_blank" rel="noreferrer"><img src={tx.proof_image_url} alt="إثبات المعاملة" className="max-h-80 w-full rounded-lg object-contain" /></a></div>}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4 text-sm md:grid-cols-3">
              {details.map(([label, value]) => <div key={label}><div className="text-xs text-muted">{label}</div><div className="mt-1 break-words font-semibold text-text">{value || '—'}</div></div>)}
            </div>
            {linkedId && <button onClick={() => navigate(`/monitor?tx=${encodeURIComponent(linkedId)}`)} className="rounded-lg border border-gold/40 px-3 py-2 text-sm font-semibold text-gold hover:bg-gold/10">فتح تفاصيل المعاملة المرتبطة</button>}
            {!linkedId && <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
              <div className="mb-2 text-sm font-bold text-gold">DMD — ربط يدوي بالمعاملة</div>
              <div className="mb-3 text-xs text-muted">إذا لم يتم الربط التلقائي، أدخل رقم معاملة Maven لربط هذه الرسالة بها.</div>
              {recommendedTx && (
                <div className="mb-3 rounded-lg border border-success/40 bg-success/10 p-3">
                  <div className="mb-1 text-xs font-bold text-success">🎯 معاملة مقترحة — نفس المبلغ والأقرب زمنياً</div>
                  <div className="text-sm text-text">#{recommendedTx.tx_id} · {formatMoney(recommendedTx.amount)} · {formatAbsoluteDate(recommendedTx.created_utc)} · فرق {Math.round(recommendedTx.diffMs / 60000)} دقيقة{recommendedTx.sender_name || recommendedTx.sender_number ? ` · ${recommendedTx.sender_name || recommendedTx.sender_number}` : ''}</div>
                  {recommendedIsSameWallet && <div className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-xs font-semibold text-danger">⚠ رقم المرسل في هذه المعاملة هو رقم محفظتنا — تحقق قبل الربط</div>}
                  {recommendedCandidates.length > 1 && <div className="mt-1 text-xs text-muted">+{recommendedCandidates.length - 1} معاملة أخرى بنفس المبلغ</div>}
                  <button onClick={() => setLinkTxId(String(recommendedTx.tx_id))} className="mt-2 rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white">استخدام هذا الرقم</button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <input value={linkTxId} onChange={(e) => setLinkTxId(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="رقم معاملة Maven" className="min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" />
                <button onClick={manuallyLinkTransaction} disabled={linkingTx || !linkTxId} className="rounded-lg bg-gold px-3 py-2 text-sm font-bold text-bg disabled:opacity-50">{linkingTx ? 'جارٍ الربط...' : 'ربط بالمعاملة'}</button>
              </div>
            </div>}
            <div><div className="mb-2 flex items-center justify-between gap-2"><div className="text-xs font-semibold text-muted">النص الخام الكامل</div><button onClick={saveRawSms} disabled={savingRaw} className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{savingRaw ? 'جارٍ الحفظ...' : 'حفظ التعديل'}</button></div><textarea value={rawDraft} onChange={(e) => setRawDraft(e.target.value)} rows={8} dir="auto" className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-6 text-text outline-none focus:border-gold" placeholder="لا يوجد نص خام لهذه الرسالة" /></div>
          </div>
        })()}
      </Modal>
    </div>
  )
}
