import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Link2, Loader2, Search, ShieldX, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../utils/format'
import Topbar from '../components/Topbar'
import { useToast } from '../components/Toast'
import { downloadXlsx } from '../utils/xlsx'

const VERDICTS = {
  engine_conflict: { ar: 'تعارض في المحرك', tone: 'danger', order: 1 },
  valid_unlinked: { ar: 'صالحة وغير مرتبطة', tone: 'success', order: 2 },
  misallocated: { ar: 'تخصيص خاطئ', tone: 'danger', order: 3 },
  manual_review: { ar: 'مراجعة يدوية', tone: 'warning', order: 4 },
  duplicate_submission: { ar: 'طلب مكرر', tone: 'muted', order: 5 },
  already_paid: { ar: 'مدفوعة بالفعل', tone: 'success', order: 6 },
  correctly_declined: { ar: 'مرفوضة بشكل صحيح', tone: 'muted', order: 7 },
  not_found: { ar: 'غير موجودة', tone: 'danger', order: 8 },
}

const toneClasses = {
  danger: 'border-danger/35 bg-danger/10 text-danger', success: 'border-success/35 bg-success/10 text-success',
  warning: 'border-warning/35 bg-warning/10 text-warning', muted: 'border-border bg-surface text-muted',
}

function extractReferences(value) {
  const valid = [], invalid = []
  for (const line of String(value || '').split(/\r?\n/)) {
    if (!line.trim()) continue
    const matches = line.match(/(?<!\d)\d{11}(?!\d)/g) || []
    if (matches.length) valid.push(...matches); else invalid.push(line.trim().slice(0, 120))
  }
  return { valid: [...new Set(valid)], invalid }
}

function formatTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })
}

function VerdictBadge({ verdict }) {
  const meta = VERDICTS[verdict] || VERDICTS.not_found
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${toneClasses[meta.tone]}`}>{meta.ar}</span>
}

export default function Complaints() {
  const { showToast } = useToast()
  const uploadRef = useRef(null)
  const [master, setMaster] = useState('NGPay')
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const [generatedAt, setGeneratedAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')
  const parsed = useMemo(() => extractReferences(input), [input])
  const groups = useMemo(() => {
    const grouped = new Map()
    for (const row of results) { if (!grouped.has(row.verdict)) grouped.set(row.verdict, []); grouped.get(row.verdict).push(row) }
    return [...grouped.entries()].sort(([a], [b]) => (VERDICTS[a]?.order || 99) - (VERDICTS[b]?.order || 99))
  }, [results])
  const summary = useMemo(() => Object.keys(VERDICTS).map((verdict) => {
    const rows = results.filter((row) => row.verdict === verdict)
    return { verdict, count: rows.length, amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0) }
  }).filter((item) => item.count > 0), [results])

  async function investigate() {
    if (!parsed.valid.length) { setError('أدخل رقماً مرجعياً واحداً صالحاً على الأقل (11 رقماً).'); return }
    setLoading(true); setError('')
    const { data, error: rpcError } = await supabase.rpc('investigate_merchant_complaints', { p_references: parsed.valid, p_master_merchant: master })
    if (rpcError) { setError(`تعذر تشغيل التحقيق: ${rpcError.message}`); setResults([]) }
    else { setResults(data?.rows || []); setGeneratedAt(data?.generatedAt || new Date().toISOString()) }
    setLoading(false)
  }

  async function readCsv(file) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('حجم ملف CSV يجب ألا يتجاوز 5 MB.'); return }
    const text = await file.text()
    setInput((current) => [current.trim(), text.trim()].filter(Boolean).join('\n'))
    if (uploadRef.current) uploadRef.current.value = ''
  }

  async function applyAction(row, action) {
    const labels = { approve_paid: 'اعتماد العملية كمدفوعة', link_sms: 'ربط رسالة SMS', reject_complaint: 'رفض الشكوى' }
    if (!window.confirm(`${labels[action]} للمرجع ${row.merchant_reference}؟`)) return
    const note = window.prompt('ملاحظة الإجراء (اختيارية):', '')
    if (note === null) return
    const key = `${row.tx_id}:${action}`; setBusyKey(key)
    const { error: actionError } = await supabase.rpc('apply_complaint_investigation_action', { p_tx_id: row.tx_id, p_action: action, p_sms_id: action === 'link_sms' ? row.sms_id : null, p_note: note })
    setBusyKey('')
    if (actionError) { showToast(`فشل الإجراء: ${actionError.message}`, 'error'); return }
    showToast('تم تنفيذ الإجراء وتسجيل المستخدم والتوقيت.', 'success')
    await investigate()
  }

  async function exportXlsx() {
    if (!results.length) return
    const columns = [
      { header: 'المرجع التجاري', key: 'merchant_reference', width: 18 }, { header: 'رقم العملية', key: 'tx_id', width: 16 },
      { header: 'النتيجة', key: 'verdict', width: 23 }, { header: 'السبب', key: 'cause', width: 34 },
      { header: 'المبلغ (ج.م)', key: 'amount', width: 16 }, { header: 'الحالة', key: 'status', width: 14 },
      { header: 'المحفظة المستقبلة', key: 'wallet', width: 18 }, { header: 'رقم SMS', key: 'sms_id', width: 14 },
      { header: 'وقت SMS', key: 'sms_timestamp', width: 23 }, { header: 'الفارق بالدقائق', key: 'delta', width: 17 },
      { header: 'عملية مرتبطة', key: 'related', width: 18 }, { header: 'من اعتمد', key: 'approved_by', width: 20 },
    ]
    const rows = results.map((row) => ({ merchant_reference: row.merchant_reference, tx_id: row.tx_id || '', verdict: VERDICTS[row.verdict]?.ar || row.verdict, cause: row.cause, amount: Number(row.amount || 0), status: row.status || '', wallet: row.receiving_wallet || '', sms_id: row.sms_id || '', sms_timestamp: formatTimestamp(row.sms_timestamp), delta: row.time_delta_minutes ?? '', related: row.sibling_tx_id || row.allocated_to_tx_id || '', approved_by: row.approved_by || '' }))
    downloadXlsx({ filename: `ontarget-complaints-${master.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName: 'رد التاجر', columns, rows })
  }

  return <div className="flex h-full flex-col bg-bg">
    <Topbar title="تحقيق الشكاوى" subtitle="تحليل آلي يعتمد على المحفظة المستقبلة قبل المبلغ والتوقيت" onRefresh={results.length ? investigate : undefined} isFetching={loading} />
    <main className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6" dir="rtl">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div role="tablist" aria-label="التاجر الرئيسي" className="inline-flex rounded-xl border border-border bg-surface p-1">{['NGPay', 'PayFuture'].map((value) => <button key={value} role="tab" aria-selected={master === value} onClick={() => { setMaster(value); setResults([]) }} className={`rounded-lg px-5 py-2 text-sm font-bold ${master === value ? 'bg-gold text-white shadow-sm' : 'text-muted hover:text-text'}`}>{value}</button>)}</div>
          <button type="button" onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-text hover:border-gold"><Upload size={17} />رفع CSV</button>
          <input ref={uploadRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void readCsv(event.target.files?.[0])} />
        </div>
        <label htmlFor="complaint-refs" className="mt-4 block text-sm font-bold text-text">مراجع معاملات التاجر</label>
        <p id="refs-help" className="mt-1 text-xs text-muted">مرجع واحد من 11 رقماً في كل سطر، أو الصق صفوف CSV. لا يتم استخدام رقم العملية المكرر كمرجع.</p>
        <textarea id="complaint-refs" aria-describedby="refs-help" value={input} onChange={(event) => setInput(event.target.value)} rows={7} placeholder={'23144995329\n23144995330'} className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-3 font-mono text-sm text-text shadow-inner outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={() => void investigate()} disabled={loading || !parsed.valid.length} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 font-bold text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}تشغيل التحقيق</button>
          <span className="text-xs font-bold text-success">{parsed.valid.length} مرجع صالح</span>
          {parsed.invalid.length > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold text-warning"><AlertTriangle size={14} />{parsed.invalid.length} سطر غير صالح سيتم تجاهله</span>}
          {results.length > 0 && <button onClick={() => void exportXlsx()} className="mr-auto inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-text hover:border-gold"><Download size={17} />تصدير XLSX</button>}
        </div>
        {error && <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</div>}
      </section>

      {summary.length > 0 && <section aria-label="ملخص النتائج" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{summary.map((item) => { const meta = VERDICTS[item.verdict]; return <article key={item.verdict} className={`rounded-xl border p-3 ${toneClasses[meta.tone]}`}><div className="text-xs font-bold">{meta.ar}</div><div className="mt-2 flex items-end justify-between gap-2"><strong className="text-2xl">{item.count}</strong><span className="text-xs font-bold">{formatMoney(item.amount)}</span></div></article> })}</section>}
      {generatedAt && <p className="text-xs text-muted">آخر تحقيق: {formatTimestamp(generatedAt)} · {results.length} نتيجة · {master}</p>}

      {groups.map(([verdict, rows]) => { const meta = VERDICTS[verdict] || VERDICTS.not_found; return <section key={verdict} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <header className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${toneClasses[meta.tone]}`}><div className="flex items-center gap-2"><FileSpreadsheet size={18} /><h2 className="font-extrabold">{meta.ar}</h2><span className="rounded-full bg-card/70 px-2 py-0.5 text-xs">{rows.length}</span></div><strong>{formatMoney(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0))}</strong></header>
        <div className="overflow-x-auto"><table className="min-w-[1280px] w-full text-right text-sm">
          <thead><tr className="border-b border-border bg-surface text-xs text-muted"><th className="px-3 py-3">مرجع التاجر</th><th className="px-3 py-3">رقم العملية</th><th className="px-3 py-3">المبلغ</th><th className="px-3 py-3">الحالة</th><th className="px-3 py-3">المحفظة</th><th className="px-3 py-3">SMS</th><th className="px-3 py-3">وقت SMS</th><th className="px-3 py-3">الفارق</th><th className="px-3 py-3">السبب</th><th className="px-3 py-3">عملية أخرى</th><th className="px-3 py-3">الإجراءات</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.merchant_reference}:${row.tx_id || 'missing'}`} className="border-b border-border/80 align-top last:border-0 hover:bg-surface/70">
            <td className="px-3 py-3 font-mono font-bold text-gold">{row.merchant_reference}</td><td className="px-3 py-3 font-mono">{row.tx_id || '—'}</td><td className="px-3 py-3 font-mono font-bold">{formatMoney(row.amount)}</td>
            <td className="px-3 py-3"><div className="font-bold">{row.status || '—'}</div><div className="mt-1"><VerdictBadge verdict={row.verdict} /></div></td><td className="px-3 py-3 font-mono">{row.receiving_wallet || '—'}</td><td className="px-3 py-3 font-mono">{row.sms_id || '—'}</td>
            <td className="px-3 py-3 whitespace-nowrap text-xs">{formatTimestamp(row.sms_timestamp)}</td><td className="px-3 py-3 font-mono">{row.time_delta_minutes == null ? '—' : `${row.time_delta_minutes} د`}</td>
            <td className="max-w-64 px-3 py-3"><span className="font-semibold text-text">{row.cause}</span>{row.candidate_count > 1 && <div className="mt-1 text-xs text-warning">{row.candidate_count} رسائل مرشحة</div>}</td><td className="px-3 py-3 font-mono">{row.sibling_tx_id || row.allocated_to_tx_id || '—'}</td>
            <td className="px-3 py-3"><div className="flex min-w-72 flex-wrap gap-2">
              <button disabled={!row.tx_id || row.status === 'PAID' || !!busyKey} onClick={() => void applyAction(row, 'approve_paid')} className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{busyKey === `${row.tx_id}:approve_paid` ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}اعتماد كمدفوعة</button>
              <button title={row.sms_id && ['valid_unlinked', 'manual_review'].includes(row.verdict) ? 'ربط الرسالة' : 'الرسالة غير متاحة للربط الآمن'} disabled={!row.tx_id || !row.sms_id || !['valid_unlinked', 'manual_review'].includes(row.verdict) || !!busyKey} onClick={() => void applyAction(row, 'link_sms')} className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-bold text-gold disabled:opacity-40">{busyKey === `${row.tx_id}:link_sms` ? <Loader2 className="animate-spin" size={14} /> : <Link2 size={14} />}ربط SMS</button>
              <button disabled={!row.tx_id || !!busyKey} onClick={() => void applyAction(row, 'reject_complaint')} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/35 bg-danger/10 px-3 py-2 text-xs font-bold text-danger disabled:opacity-40">{busyKey === `${row.tx_id}:reject_complaint` ? <Loader2 className="animate-spin" size={14} /> : <ShieldX size={14} />}رفض الشكوى</button>
            </div></td>
          </tr>)}</tbody>
        </table></div>
      </section> })}
      {!loading && !results.length && <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><Search className="mx-auto text-muted" size={34} /><h2 className="mt-3 font-bold text-text">ألصق مراجع المعاملات لتشغيل التحقيق</h2><p className="mt-1 text-sm text-muted">سيتم تجميع النتائج حسب الحكم مع إجمالي العدد والمبلغ.</p></section>}
    </main>
  </div>
}
