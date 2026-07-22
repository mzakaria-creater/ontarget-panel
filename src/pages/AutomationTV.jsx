import { useEffect, useMemo, useState } from 'react'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatMoney, formatNumber, formatRelativeTime, formatAbsoluteDate } from '../utils/format'
import PaymentMethodBadge from '../components/PaymentMethodBadge'
import { supabase } from '../lib/supabase'

function statusTone(status) {
  if (status === 'PAID' || status === 'completed') return 'text-success'
  if (status === 'DECLINED' || status === 'failed') return 'text-danger'
  return 'text-warning'
}

function UrgentTurboButton() {
  const [busy, setBusy] = useState(false)
  const [until, setUntil] = useState(() => Number(localStorage.getItem('ontarget-turbo-stop-at') || 0))
  const active = until > Date.now()
  async function runUrgent() {
    setBusy(true)
    const stopAt = Date.now() + 10 * 60 * 1000
    const settings = await supabase.from('automation_settings').update({ turbo_mode: true, automation_enabled: true, decline_grace_minutes: 3 }).eq('id', 1)
    const jobs = await supabase.from('browser_jobs').update({ priority: 1000, next_run_at: new Date().toISOString() }).eq('state', 'pending')
    if (!settings.error && !jobs.error) { localStorage.setItem('ontarget-turbo-stop-at', String(stopAt)); setUntil(stopAt) }
    setBusy(false)
  }
  async function stopUrgent() {
    setBusy(true); await supabase.from('automation_settings').update({ turbo_mode: false }).eq('id', 1); localStorage.removeItem('ontarget-turbo-stop-at'); setUntil(0); setBusy(false)
  }
  useEffect(() => { if (!until) return undefined; const timer = setInterval(() => { if (Date.now() >= until) stopUrgent() }, 1000); return () => clearInterval(timer) }, [until])
  return <button onClick={active ? stopUrgent : runUrgent} disabled={busy} className={`rounded-xl border px-3 py-2 text-xs font-black ${active ? 'border-danger/50 bg-danger/10 text-danger' : 'border-gold/40 bg-gold/10 text-gold'} disabled:opacity-50`}>{active ? '⏹ إيقاف Turbo' : '🚀 Turbo عاجل · 3 دقائق'}{active && <span className="ml-1 text-[10px]">({Math.max(0, Math.ceil((until - Date.now()) / 60000))}د)</span>}</button>
}

function MobileTvDropdown() {
  function go(event) {
    if (event.target.value) window.location.assign(event.target.value)
  }
  return <select aria-label="تنقل سريع في TV" defaultValue="" onChange={go} className="w-full max-w-[220px] rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-text md:hidden"><option value="">☰ تنقل سريع في TV</option><option value="/tvscreen">📺 شاشة TV</option><option value="/wallet-monitor">📱 هواتف المحافظ</option><option value="/monitor">📊 المراقبة</option><option value="/smslive">📨 رسائل SMS</option><option value="/recovery-panel">⚡ الاسترجاع</option></select>
}

function Panel({ title, eyebrow, children, className = '' }) {
  return <section className={`rounded-3xl border border-border bg-card/80 p-5 shadow-lg shadow-slate-950/5 ${className}`}><div className="mb-4 flex items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">{eyebrow}</div><h2 className="mt-1 text-lg font-extrabold text-text">{title}</h2></div>{title === 'Automation pipeline' ? <div className="flex items-center gap-2"><MobileTvDropdown /><UrgentTurboButton /></div> : <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_14px_var(--color-success)]" />}</div>{children}</section>
}

function refsFromTx(tx) {
  const raw = tx?.maven_raw_row && typeof tx.maven_raw_row === 'object' ? tx.maven_raw_row : tx?.raw && typeof tx.raw === 'object' ? tx.raw : {}
  return [raw.Reference1, raw.Reference, raw.UTRNumber, tx?.trx_id, tx?.trx_reference].map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean)
}

function refsFromSms(sms) {
  return [sms?.trx_id, sms?.trx_reference].map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean)
}

export default function AutomationTV() {
  const [now, setNow] = useState(new Date())
  const transactions = useRealtimeTable({ key: ['automation-tv-transactions'], queryFn: async (sb) => sb.from('maven_transactions').select('tx_id, amount, status, sender_name, sender_number, payment_method, created_utc, updated_at, raw, maven_raw_row').order('updated_at', { ascending: false }).limit(80), intervalMs: 10000 })
  const sms = useRealtimeTable({ key: ['automation-tv-sms'], queryFn: async (sb) => sb.from('inbound_sms').select('id, amount, sms_category, sender_name, sender_number, receiver_number, confirmed_wallet_number, wallet_name, wallet, device_name, received_at, matched, match_status, consumed_by_tx_id, matched_transaction_id, maven_transaction_id, trx_id, trx_reference, balance_after, message, raw_sms').order('received_at', { ascending: false }).limit(80), intervalMs: 10000 })
  const jobs = useRealtimeTable({ key: ['automation-tv-jobs'], queryFn: async (sb) => sb.from('browser_jobs').select('id, tx_id, target_status, state, source, created_at, updated_at, completed_at').order('updated_at', { ascending: false }).limit(80), intervalMs: 10000 })

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])

  const txRows = useMemo(() => transactions.data || [], [transactions.data])
  const smsRows = useMemo(() => sms.data || [], [sms.data])
  const jobRows = useMemo(() => jobs.data || [], [jobs.data])
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayTx = txRows.filter((row) => new Date(row.created_utc || 0) >= today)
    const matched = smsRows.filter((row) => row.matched || row.match_status || row.consumed_by_tx_id || row.matched_transaction_id || row.maven_transaction_id).length
    return { today: todayTx.length, volume: todayTx.reduce((sum, row) => sum + Number(row.amount || 0), 0), paid: todayTx.filter((row) => row.status === 'PAID').length, pending: todayTx.filter((row) => row.status === 'PENDING').length, declined: todayTx.filter((row) => row.status === 'DECLINED').length, matched, running: jobRows.filter((row) => row.state === 'running').length, queued: jobRows.filter((row) => row.state === 'pending').length }
  }, [txRows, smsRows, jobRows])

  const latestJobs = jobRows.slice(0, 7)
  const latestTransactions = txRows.slice(0, 15)
  const latestSms = smsRows.slice(0, 15)
  const matches = useMemo(() => {
    const byTx = new Map()
    const byRef = new Map()
    for (const row of smsRows) {
      for (const id of [row.consumed_by_tx_id, row.matched_transaction_id, row.maven_transaction_id].filter(Boolean)) byTx.set(String(id), row)
      for (const ref of refsFromSms(row)) if (!byRef.has(ref)) byRef.set(ref, row)
    }
    return txRows.map((tx) => ({ tx, sms: byTx.get(String(tx.tx_id)) || refsFromTx(tx).map((ref) => byRef.get(ref)).find(Boolean) })).filter((row) => row.sms).slice(0, 8)
  }, [txRows, smsRows])
  const successRate = stats.today ? Math.round((stats.paid / stats.today) * 100) : 0

  return <div className="h-full overflow-y-auto bg-bg p-4 text-text md:p-6 xl:p-8"><div className="mx-auto max-w-[1800px] space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/15 via-card to-card p-6 shadow-xl shadow-gold/5"><div><div className="mb-2 flex items-center gap-3"><span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-success" /></span><span className="text-xs font-black uppercase tracking-[0.3em] text-success">Live automation theater</span></div><h1 className="text-3xl font-black tracking-tight md:text-5xl">Monitor Process TV</h1><p className="mt-2 max-w-2xl text-sm text-muted md:text-base">مراقبة مباشرة لمسار العملية: استقبال البيانات، المطابقة، القرار، ثم التنفيذ الآلي.</p></div><div className="text-left md:text-right"><div className="font-mono text-3xl font-black text-gold">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Cairo' })}</div><div className="mt-1 text-xs text-muted">Cairo · {now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', timeZone: 'Africa/Cairo' })}</div><div className="mt-3 text-xs font-bold text-success">● AUTO REFRESH 10s</div></div></header>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{[['Today transactions', formatNumber(stats.today), '📊', 'text-gold'], ['Volume', formatMoney(stats.volume), '💰', 'text-gold'], ['Success rate', `${successRate}%`, '✅', 'text-success'], ['Pending', formatNumber(stats.pending), '⏳', 'text-warning'], ['Declined', formatNumber(stats.declined), '⛔', 'text-danger'], ['SMS matched', formatNumber(stats.matched), '📨', 'text-violet-500'], ['Jobs running', formatNumber(stats.running), '⚙️', 'text-blue-500']].map(([label, value, icon, tone]) => <div key={label} className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center justify-between text-xs text-muted"><span>{label}</span><span>{icon}</span></div><div className={`mt-2 truncate text-2xl font-black ${tone}`}>{value}</div></div>)}</div>

    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><Panel title="Automation pipeline" eyebrow="Process flow" className="min-h-[270px]"><div className="grid gap-3 md:grid-cols-4">{[['01', 'INGEST', 'SMS + Maven events', smsRows.length, '📡', 'text-blue-500'], ['02', 'MATCH', 'Rules + AI signals', stats.matched, '🧩', 'text-violet-500'], ['03', 'DECIDE', 'Paid / pending / declined', stats.paid + stats.pending + stats.declined, '🧠', 'text-gold'], ['04', 'EXECUTE', 'Browser jobs', stats.running + stats.queued, '⚡', 'text-success']].map(([step, name, sub, value, icon, tone], index) => <div key={name} className="relative rounded-2xl border border-border bg-surface p-4"><div className="flex items-center justify-between"><span className="font-mono text-xs font-bold text-muted">{step}</span><span className="text-xl">{icon}</span></div><div className={`mt-5 text-sm font-black tracking-widest ${tone}`}>{name}</div><div className="mt-1 text-xs text-muted">{sub}</div><div className="mt-4 text-2xl font-black text-text">{formatNumber(value)}</div>{index < 3 && <span className="absolute -right-3 top-1/2 z-10 hidden text-xl text-gold md:block">›</span>}</div>)}</div><div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-xs"><span className="text-muted">Queue state</span><span className="font-bold text-success">{stats.queued ? `${stats.queued} jobs waiting` : 'Clear · all systems flowing'}</span></div></Panel>
      <Panel title="Execution activity" eyebrow="Browser worker"><div className="space-y-2">{latestJobs.length ? latestJobs.map((job) => <div key={job.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${job.state === 'completed' ? 'bg-success' : job.state === 'failed' ? 'bg-danger' : 'bg-warning animate-pulse'}`} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-text">TX #{job.tx_id} · {job.target_status || '—'}</div><div className="text-[11px] text-muted">{job.source || 'automation'} · {formatRelativeTime(job.updated_at || job.created_at)}</div></div><span className={`text-xs font-bold uppercase ${statusTone(job.state)}`}>{job.state}</span></div>) : <div className="py-10 text-center text-sm text-muted">No automation jobs yet</div>}</div></Panel></div>

    <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]"><Panel title="📨 رسائل SMS حية" eyebrow="كل رسائل SMS — جدول شامل"><div className="mb-3 flex items-center justify-between text-xs text-muted"><span>{formatNumber(smsRows.length)} رسالة · تحديث كل 10 ثواني</span><span>● مباشر</span></div><div className="max-h-[620px] overflow-auto rounded-xl border border-border"><table className="w-full min-w-[900px] text-sm"><thead className="sticky top-0 z-10 bg-surface text-[11px] text-muted"><tr><th className="px-3 py-3 text-left">الجهاز</th><th className="px-3 py-3 text-left">النوع</th><th className="px-3 py-3 text-left">المبلغ</th><th className="px-3 py-3 text-left">من/إلى</th><th className="px-3 py-3 text-left">🏦 محفظة الاستقبال</th><th className="px-3 py-3 text-left">رقم العملية</th><th className="px-3 py-3 text-left">الرصيد بعدها</th><th className="px-3 py-3 text-left">معاملة مرتبطة</th><th className="px-3 py-3 text-left">الوقت</th></tr></thead><tbody>{latestSms.map((row) => { const linked = row.consumed_by_tx_id || row.matched_transaction_id || row.maven_transaction_id; return <tr key={row.id} className="border-t border-border"><td className="px-3 py-3 font-bold text-gold">{row.device_name || '—'}</td><td className="px-3 py-3"><span className="mr-1 text-warning">{row.sms_category === 'withdrawal' ? '💸' : '🟠'}</span>{row.sms_category === 'withdrawal' ? 'سحب' : 'إيداع'}</td><td className="px-3 py-3 font-bold">{formatMoney(row.amount)}</td><td className="max-w-[170px] truncate px-3 py-3" title={row.sender_name || row.sender_number}>{row.sender_name || row.sender_number || row.receiver_number || '—'}</td><td className="px-3 py-3">{row.confirmed_wallet_number || row.wallet_name || row.wallet || row.receiver_number || '—'}</td><td className="px-3 py-3 font-mono text-xs">{row.trx_id || row.trx_reference || '—'}</td><td className="px-3 py-3">{formatMoney(row.balance_after)}</td><td className="px-3 py-3">{linked ? <span className="font-bold text-success">#{linked}</span> : <span className="text-muted">—</span>}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-muted">{formatAbsoluteDate(row.received_at)}</td></tr> })}</tbody></table></div></Panel>
      <div className="space-y-5"><Panel title="💳 معاملات حية" eyebrow="Maven stream"><div className="max-h-[390px] space-y-2 overflow-auto">{latestTransactions.map((row) => <div key={row.tx_id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3"><div className={`text-lg ${row.status === 'PAID' ? 'text-success' : 'text-warning'}`}>{row.status === 'PAID' ? '●' : '○'}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-bold">{formatMoney(row.amount)} · {row.sender_name || row.sender_number || '—'}</span><span className={`font-bold ${statusTone(row.status)}`}>{row.status}</span></div><div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted"><PaymentMethodBadge value={row.payment_method} /><span>{formatAbsoluteDate(row.updated_at || row.created_utc)}</span><span className="font-mono">#{row.tx_id}</span></div></div></div>)}</div></Panel>
        <Panel title="🎯 مطابقة تلقائية" eyebrow="TRX + SMS"><div className="space-y-2">{matches.length ? matches.map(({ tx, sms: row }) => <div key={`${tx.tx_id}-${row.id}`} className="rounded-xl border border-success/25 bg-success/5 px-4 py-3"><div className="mb-1 flex items-center justify-between gap-2"><span className="text-sm font-black text-success">💥 تطابق!</span><span className="text-xs text-muted">{formatAbsoluteDate(row.received_at)}</span></div><div className="text-sm font-bold text-text">معاملة #{tx.tx_id} — {formatMoney(tx.amount)}</div><div className="mt-1 text-xs text-muted">{tx.sender_name || tx.sender_number || '—'} · {tx.status === 'PAID' ? '✅ قبول' : '⏳ قيد المعالجة'}</div></div>) : <div className="py-8 text-center text-sm text-muted">بانتظار المطابقات الجديدة</div>}</div></Panel></div></div>
  </div></div>
}
