import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { formatAbsoluteDate, formatMoney, formatNumber } from '../utils/format'
import { useLanguage } from '../components/LanguageContext'
import Topbar from '../components/Topbar'
import TransactionSmsTable from '../components/TransactionSmsTable'

const COLORS = ['#d4af37', '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#e74c3c', '#1abc9c']
const TABS = [['ov', '📊', 'نظرة عامة', 'Overview'], ['dy', '📅', 'يومي', 'Daily'], ['wl', '👛', 'المحافظ', 'Wallets'], ['mr', '🏢', 'التجار', 'Merchants'], ['sm', '📱', 'SMS وتدقيق', 'SMS audit'], ['og', '💸', 'الخارج', 'Outgoing'], ['tx', '🗄️', 'المعاملات', 'Transactions']]

const asNum = (value) => Number(value || 0)
const pct = (a, b) => b ? Math.round((asNum(a) / asNum(b)) * 1000) / 10 : 0
const shortWallet = (value) => value && value.length > 14 ? `${value.slice(0, 5)}…${value.slice(-4)}` : value || '—'

export default function FullReport() {
  const { t } = useLanguage()
  const [tab, setTab] = useState('ov')
  const [filters, setFilters] = useState({ from: '2026-07-01', to: '2026-07-21', merchant: '', status: '' })
  const [data, setData] = useState({ daily: [], wallets: [], txs: [], recon: [], outgoing: [], rawSms: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    const queries = await Promise.all([
      supabase.from('v_report_daily').select('*').order('d', { ascending: true }),
      supabase.from('v_report_wallets').select('*'),
      supabase.from('v_wallet_recent_transactions').select('*').order('tx_time', { ascending: false }).limit(5000),
      supabase.from('v_wallet_sms_reconciliation').select('*'),
      supabase.from('v_report_outgoing').select('*').order('received_at', { ascending: false }).limit(500),
      supabase.from('inbound_sms').select('id, consumed_by_tx_id, matched_transaction_id, maven_transaction_id, received_at, amount, sender_number, sender_name, provider, raw_sms, message, trx_id, trx_reference, match_status, matched').order('received_at', { ascending: false }).limit(5000),
    ])
    const failed = queries.find((item) => item.error)
    if (failed) setError(failed.error.message)
    setData({ daily: queries[0].data || [], wallets: queries[1].data || [], txs: queries[2].data || [], recon: queries[3].data || [], outgoing: queries[4].data || [], rawSms: queries[5].data || [] })
    setLoading(false)
  }
  useEffect(() => { load(); const timer = setInterval(load, 120000); return () => clearInterval(timer) }, [])

  const merchants = useMemo(() => [...new Set(data.wallets.map((row) => cleanMerchant(row.merchant)).filter(Boolean))].sort(), [data.wallets])
  const filtered = useMemo(() => {
    const daily = data.daily.filter((row) => (!filters.from || row.d >= filters.from) && (!filters.to || row.d <= filters.to))
    const wallets = data.wallets.filter((row) => !filters.merchant || cleanMerchant(row.merchant) === filters.merchant)
    const txs = data.txs.filter((row) => { const date = String(row.tx_time || '').slice(0, 10); return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to) && (!filters.status || row.status === filters.status) && (!filters.merchant || cleanMerchant(row.merchant) === filters.merchant) })
    return { daily, wallets, txs }
  }, [data, filters])
  const stats = useMemo(() => {
    const paid = filtered.txs.filter((row) => row.status === 'PAID')
    const declined = filtered.txs.filter((row) => row.status === 'DECLINED')
    const expired = filtered.txs.filter((row) => row.status === 'EXPIRED')
    const volume = filtered.wallets.reduce((sum, row) => sum + asNum(row.paid_amt), 0) || paid.reduce((sum, row) => sum + asNum(row.amount), 0)
    const matched = new Set(data.recon.filter((row) => asNum(row.sms_matched_tx) > 0).map((row) => String(row.wallet)))
    const smsWallets = filtered.wallets.filter((row) => matched.has(String(row.wallet))).length
    return { paid: paid.length || filtered.daily.reduce((sum, row) => sum + asNum(row.paid_tx), 0), declined: declined.length || filtered.daily.reduce((sum, row) => sum + asNum(row.dec_tx), 0), expired: expired.length || filtered.daily.reduce((sum, row) => sum + asNum(row.exp_tx), 0), volume, success: pct(paid.length, filtered.txs.length), smsRate: pct(smsWallets, filtered.wallets.length) }
  }, [filtered, data.recon])

  function reset() { setFilters({ from: '2026-07-01', to: '2026-07-21', merchant: '', status: '' }) }
  function quick(type) { if (type === 'jul') setFilters((f) => ({ ...f, from: '2026-07-01', to: '2026-07-21' })); else if (type === 'all') setFilters((f) => ({ ...f, from: '', to: '' })); else { const today = new Date(); const from = new Date(); from.setDate(today.getDate() - 7); setFilters((f) => ({ ...f, from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) })) } }

  return <div className="flex h-full min-h-0 flex-col bg-bg"><Topbar title={t('OnTarget — تقرير شامل', 'OnTarget — Full report')} subtitle={t('NagoPay × Maven × محافظ × SMS · حي', 'NagoPay × Maven × wallets × SMS · Live')} onRefresh={load} isFetching={loading} /><div className="flex-1 overflow-y-auto bg-bg p-4 md:p-6">
    {error && <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">تعذر تحميل بعض مصادر التقرير: {error}</div>}
    <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur"><label className="text-xs text-muted">من<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="mr-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-text" /></label><label className="text-xs text-muted">إلى<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="mr-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-text" /></label><select value={filters.merchant} onChange={(e) => setFilters({ ...filters, merchant: e.target.value })} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text"><option value="">كل التجار</option>{merchants.map((merchant) => <option key={merchant}>{merchant}</option>)}</select><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text"><option value="">كل الحالات</option><option>PAID</option><option>DECLINED</option><option>EXPIRED</option><option>UNDERPAID</option></select><button onClick={() => quick(7)} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:border-gold hover:text-gold">7 أيام</button><button onClick={() => quick('jul')} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:border-gold hover:text-gold">يوليو كله</button><button onClick={() => quick('all')} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:border-gold hover:text-gold">كل البيانات</button><button onClick={reset} className="rounded-lg bg-gold px-3 py-2 text-xs font-bold text-bg">↺ إعادة</button></div>
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">{TABS.map(([key, icon, ar, en]) => <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${tab === key ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-text'}`}>{icon} {t(ar, en)}</button>)}</div>
    {tab === 'ov' && <Overview data={filtered} stats={stats} recon={data.recon} />}
    {tab === 'dy' && <Daily data={filtered.daily} />}
    {tab === 'wl' && <Wallets data={filtered.wallets} recon={data.recon} />}
    {tab === 'mr' && <Merchants data={filtered.wallets} />}
    {tab === 'sm' && <SmsAudit data={data.recon} />}
    {tab === 'og' && <Outgoing data={data.outgoing} />}
    {tab === 'tx' && <Transactions data={filtered.txs} smsRows={data.rawSms} loading={loading} error={error} />}
  </div></div>
}

function Overview({ data, stats, recon }) {
  const daily = data.daily.map((row) => ({ name: row.d?.slice(5), value: asNum(row.paid_amt) }))
  const status = [{ name: 'PAID', value: stats.paid }, { name: 'DECLINED', value: stats.declined }, { name: 'EXPIRED', value: stats.expired }]
  const top = [...data.daily].sort((a, b) => asNum(b.paid_amt) - asNum(a.paid_amt)).slice(0, 10)
  return <><Kpis items={[["إجمالي الداخل (EGP)", formatMoney(stats.volume), 'text-gold'], ['DECLINED', formatNumber(stats.declined), 'text-danger'], ['نسبة النجاح', `${stats.success.toFixed(1)}%`, 'text-success'], ['تأكيد SMS', `${pct(recon.reduce((s, r) => s + asNum(r.sms_matched_tx), 0), recon.reduce((s, r) => s + asNum(r.paid_tx), 0)).toFixed(1)}%`, 'text-blue-500'], ['أيام النشاط', formatNumber(data.daily.filter((r) => asNum(r.paid_tx) > 0).length), 'text-violet-500'], ['محافظ نشطة', formatNumber(data.wallets.filter((r) => asNum(r.paid_tx) > 0).length), 'text-orange-500']]} /><div className="grid gap-5 lg:grid-cols-2"><Panel title="📈 الحجم اليومي (EGP)"><ChartBox><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} /><XAxis dataKey="name" stroke="var(--color-muted)" fontSize={11} /><YAxis stroke="var(--color-muted)" fontSize={11} /><Tooltip formatter={(v) => formatMoney(v)} /><Bar dataKey="value" fill="#d4af37" radius={[4, 4, 0, 0]} /></BarChart></ChartBox></Panel><Panel title="🍩 توزيع الحالات"><ChartBox><PieChart><Pie data={status} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>{status.map((item, i) => <Cell key={item.name} fill={COLORS[i + 1]} />)}</Pie><Tooltip /><Legend /></PieChart></ChartBox></Panel></div><div className="grid gap-5 lg:grid-cols-3"><Panel title="🏆 أفضل 10 أيام">{top.map((row, i) => <Line key={row.d} label={`${i + 1}. ${row.d}`} value={`${formatMoney(row.paid_amt)} ج.م`} />)}</Panel><Panel title="📅 ملخص شهري">{monthSummary(data.daily).map((row) => <Line key={row.name} label={row.name} value={`${formatMoney(row.value)} ج.م · ${formatNumber(row.count)} ✓`} />)}</Panel><Panel title="⚡ إحصاءات عامة"><Line label="متوسط يومي" value={formatMoney(stats.volume / Math.max(1, data.daily.length))} /><Line label="سحوبات صادرة" value="متاح في تبويب الخارج" /><Line label="مصادر التقرير" value="Maven · SMS · المحافظ" /></Panel></div></>
}

function Daily({ data }) { const rows = data.map((row) => ({ ...row, success: pct(row.paid_tx, asNum(row.paid_tx) + asNum(row.dec_tx) + asNum(row.exp_tx)) })); return <><Panel title="📅 النشاط اليومي"><ChartBox tall><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} /><XAxis dataKey="d" stroke="var(--color-muted)" fontSize={10} /><YAxis stroke="var(--color-muted)" fontSize={10} /><Tooltip /><Bar dataKey="paid_amt" fill="#d4af37" name="الحجم" /></BarChart></ChartBox></Panel><Panel title="جدول النشاط اليومي الكامل"><TableWrap><table><thead><tr><th>اليوم</th><th>PAID</th><th>الحجم</th><th>DECLINED</th><th>نجاح%</th><th>متوسط</th></tr></thead><tbody>{rows.map((row) => <tr key={row.d}><td>{row.d}</td><td>{formatNumber(row.paid_tx)}</td><td className="text-gold">{formatMoney(row.paid_amt)}</td><td className="text-danger">{formatNumber(row.dec_tx)}</td><td>{row.success.toFixed(1)}%</td><td>{formatMoney(row.avg_tx)}</td></tr>)}</tbody></table></TableWrap></Panel></> }

function Wallets({ data, recon }) { const map = Object.fromEntries(recon.map((row) => [row.wallet, row])); return <><Kpis items={[["محافظ نشطة", data.filter((r) => asNum(r.paid_tx) > 0).length, 'text-gold'], ['إجمالي الداخل', formatMoney(data.reduce((s, r) => s + asNum(r.paid_amt), 0)), 'text-success'], ['SMS ممتاز ≥70%', data.filter((r) => asNum(map[r.wallet]?.pct_confirmed) >= 70).length, 'text-blue-500'], ['متوسط معاملة', formatMoney(data.reduce((s, r) => s + asNum(r.paid_amt), 0) / Math.max(1, data.reduce((s, r) => s + asNum(r.paid_tx), 0))), 'text-violet-500']]} /><Panel title="👛 جميع المحافظ"><TableWrap><table><thead><tr><th>المحفظة</th><th>التاجر</th><th>معاملات</th><th>الداخل</th><th>DECLINED</th><th>نجاح%</th><th>SMS%</th><th>أيام</th></tr></thead><tbody>{data.map((row) => { const success = pct(row.paid_tx, asNum(row.paid_tx) + asNum(row.dec_tx) + asNum(row.exp_tx)); return <tr key={row.wallet}><td className="font-mono text-xs">{row.wallet}</td><td>{cleanMerchant(row.merchant)}</td><td>{formatNumber(row.paid_tx)}</td><td className="text-success">{formatMoney(row.paid_amt)}</td><td className="text-danger">{formatNumber(row.dec_tx)}</td><td>{success.toFixed(1)}%</td><td>{pct(map[row.wallet]?.sms_matched_tx, map[row.wallet]?.paid_tx).toFixed(1)}%</td><td>{formatNumber(row.active_days)}</td></tr> })}</tbody></table></TableWrap></Panel></> }

function Merchants({ data }) { const merchants = aggregateMerchants(data); return <><Kpis items={[["عدد التجار", merchants.length, 'text-gold'], ['إجمالي PAID', formatNumber(merchants.reduce((s, r) => s + r.paid_tx, 0)), 'text-success'], ['إجمالي الحجم', formatMoney(merchants.reduce((s, r) => s + r.paid_vol, 0)), 'text-blue-500']]} /><div className="grid gap-5 lg:grid-cols-2"><Panel title="🍩 توزيع الحجم"><ChartBox><PieChart><Pie data={merchants.slice(0, 8)} dataKey="paid_vol" nameKey="merchant" innerRadius={55} outerRadius={90}>{merchants.slice(0, 8).map((row, i) => <Cell key={row.merchant} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ChartBox></Panel><Panel title="📊 PAID vs DECLINED"><ChartBox><BarChart data={merchants.slice(0, 8)}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} /><XAxis dataKey="merchant" hide /><YAxis stroke="var(--color-muted)" /><Tooltip /><Legend /><Bar dataKey="paid_tx" fill="#2ecc71" name="PAID" /><Bar dataKey="dec_tx" fill="#e74c3c" name="DECLINED" /></BarChart></ChartBox></Panel></div><Panel title="🏢 تفاصيل التجار"><TableWrap><table><thead><tr><th>التاجر</th><th>PAID</th><th>الحجم</th><th>DECLINED</th><th>نجاح%</th><th>متوسط</th><th>محافظ</th></tr></thead><tbody>{merchants.map((row) => <tr key={row.merchant}><td className="font-bold">{row.merchant}</td><td>{formatNumber(row.paid_tx)}</td><td className="text-gold">{formatMoney(row.paid_vol)}</td><td className="text-danger">{formatNumber(row.dec_tx)}</td><td>{row.success.toFixed(1)}%</td><td>{formatMoney(row.avg)}</td><td>{row.wallets}</td></tr>)}</tbody></table></TableWrap></Panel></> }

function SmsAudit({ data }) { const totals = data.reduce((a, row) => ({ paid: a.paid + asNum(row.paid_tx), matched: a.matched + asNum(row.sms_matched_tx), amount: a.amount + asNum(row.sms_matched_amt), unconfirmed: a.unconfirmed + asNum(row.unconfirmed_amt) }), { paid: 0, matched: 0, amount: 0, unconfirmed: 0 }); return <><Kpis items={[['Maven PAID', formatNumber(totals.paid), 'text-gold'], ['مؤكد SMS', formatNumber(totals.matched), 'text-success'], ['غير مؤكد (EGP)', formatMoney(totals.unconfirmed), 'text-danger'], ['% تأكيد إجمالي', `${pct(totals.matched, totals.paid).toFixed(1)}%`, 'text-blue-500']]} /><Panel title="📊 تدقيق الرصيد الحي — Maven ↔ SMS"><TableWrap><table><thead><tr><th>المحفظة</th><th>Maven PAID</th><th>حجم Maven</th><th>مؤكد SMS</th><th>مبلغ SMS</th><th>% تأكيد</th><th>غير مؤكد</th><th>آخر تأكيد</th></tr></thead><tbody>{data.map((row) => <tr key={row.wallet}><td className="font-mono text-xs">{row.wallet}</td><td>{formatNumber(row.paid_tx)}</td><td>{formatMoney(row.paid_amt)}</td><td className="text-success">{formatNumber(row.sms_matched_tx)}</td><td>{formatMoney(row.sms_matched_amt)}</td><td>{pct(row.sms_matched_tx, row.paid_tx).toFixed(1)}%</td><td className="text-danger">{formatMoney(row.unconfirmed_amt)}</td><td>{formatAbsoluteDate(row.last_sms_match)}</td></tr>)}</tbody></table></TableWrap></Panel></> }

function Outgoing({ data }) { const total = data.reduce((s, row) => s + asNum(row.amount), 0); return <><Kpis items={[["إجمالي الخارج (EGP)", formatMoney(total), 'text-danger'], ['عدد السحوبات', formatNumber(data.length), 'text-gold'], ['مستلم معروف', formatNumber(data.filter((row) => row.recipient).length), 'text-blue-500']]} /><Panel title="📋 سجل السحوبات"><TableWrap><table><thead><tr><th>الوقت</th><th>المبلغ</th><th>المستلم</th><th>الجهاز</th><th>الرصيد بعدها</th></tr></thead><tbody>{data.map((row, i) => <tr key={row.id || `${row.received_at}-${i}`}><td>{formatAbsoluteDate(row.received_at)}</td><td className="text-danger">{formatMoney(row.amount)}</td><td>{row.recipient || '—'}</td><td>{row.webhook_name || '—'}</td><td>{formatMoney(row.balance_after)}</td></tr>)}</tbody></table></TableWrap></Panel></> }

function Transactions({ data, smsRows, loading, error }) { return <Panel title="🗄️ سجل المعاملات الخام + SMS الخام"><TransactionSmsTable transactions={data} smsRows={smsRows} loading={loading} error={error ? new Error(error) : null} title="المعاملات الخام + رسائل SMS الخام" emptyTitle="لا توجد معاملات" /></Panel> }

function Kpis({ items }) { return <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">{items.map(([label, value, tone]) => <div key={label} className="rounded-2xl border border-border bg-card p-4"><div className="text-xs text-muted">{label}</div><div className={`mt-2 text-xl font-black ${tone}`}>{value}</div></div>)}</div> }
function Panel({ title, children }) { return <section className="mb-5 rounded-2xl border border-border bg-card p-4 md:p-5"><h2 className="mb-4 font-bold text-gold">{title}</h2>{children}</section> }
function ChartBox({ children, tall = false }) { return <div className={tall ? 'h-[350px]' : 'h-[280px]'}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div> }
function TableWrap({ children }) { return <div className="max-w-full overflow-x-auto rounded-xl border border-border">{children}</div> }
function Line({ label, value }) { return <div className="flex justify-between gap-3 border-b border-border py-2 text-xs last:border-0"><span className="text-muted">{label}</span><b className="font-mono text-text">{value}</b></div> }
function cleanMerchant(value) { return String(value || 'غير محدد').replace(/\[REPLACED.*?\]/, '').trim() }
function monthSummary(rows) { const map = {}; rows.forEach((row) => { const month = String(row.d || '').slice(0, 7); map[month] ||= { name: month, value: 0, count: 0 }; map[month].value += asNum(row.paid_amt); map[month].count += asNum(row.paid_tx) }); return Object.values(map) }
function aggregateMerchants(rows) { const map = {}; rows.forEach((row) => { const merchant = cleanMerchant(row.merchant); map[merchant] ||= { merchant, paid_tx: 0, paid_vol: 0, dec_tx: 0, wallets: 0, walletSet: new Set() }; const item = map[merchant]; item.paid_tx += asNum(row.paid_tx); item.paid_vol += asNum(row.paid_amt); item.dec_tx += asNum(row.dec_tx); item.walletSet.add(row.wallet) }); return Object.values(map).map((row) => ({ ...row, wallets: row.walletSet.size, success: pct(row.paid_tx, row.paid_tx + row.dec_tx), avg: row.paid_tx ? row.paid_vol / row.paid_tx : 0 })) }
