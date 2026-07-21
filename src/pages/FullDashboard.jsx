import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Topbar from '../components/Topbar'
import { useLanguage } from '../components/LanguageContext'
import './FullDashboard.css'

const MERCH = [
  ['EZInvest', 'NGPay-EZInvest-Prod', 37, 5400177, .12],
  ['PayMaxis', 'NGPay-PayMaxis-Prod', 1024, 1532068.68, .02],
  ['MelBet', 'NGPay-MelBet-Prod', 3750, 1510684.66, .03],
  ['T365', 'NGPay-T365-Prod', 208, 269869.82, .02],
  ['PayMaxis-T', 'NGPay-PayMaxis-Trusteo-Prod', 72, 165154.54, .02],
  ['BetFinal', 'NGPay-BetFinal-Prod', 34, 13168, .02],
  ['T365-PX', 'NGPay-T365-PX-YYY-Prod', 16, 11590, .02],
  ['LuckyPari', 'NGPay-LuckyPari-Prod', 12, 1290, .02],
  ['Maven', 'Maven', 2, 184, 0],
]

const WALLETS = [
  ['810005106800000168011656001', 3330000, 0, 5, 0, false, 'open'], ['01213841565', 1927608.19, 0, 1217, 0, true, 'open'],
  ['168011656001', 1505000, 0, 4, 0, false, 'open'], ['01271521794', 249959, 111790, 583, 6, true, 'open'],
  ['01272691497', 172747, 0, 374, 0, true, 'open'], ['01204786953', 172015, 158785, 320, 6, true, 'open'],
  ['01202983612', 163907, 71106, 385, 5, true, 'open'], ['01282246421', 148215, 8950, 298, 2, true, 'open'],
  ['01204791978', 141531, 8800, 372, 3, true, 'open'], ['01289155314', 141333, 48090, 353, 3, true, 'open'],
  ['01202139254', 116152, 305550, 129, 20, true, 'open'], ['01014667311', 105688.66, 0, 278, 0, false, 'open'],
  ['01229352132', 55796, 0, 125, 0, true, 'open'], ['01214523295', 37633, 0, 116, 0, true, 'open'],
  ['01213841572', 33797, 0, 89, 0, true, 'open'], ['01213841564', 23687, 0, 37, 0, true, 'closed'],
  ['01220546958', 15869, 9985, 43, 1, true, 'open'], ['01217783435', 12792, 0, 68, 0, false, 'open'],
  ['01213841568', 8546, 0, 36, 0, true, 'open'], ['01217783489', 7707, 2550, 6, 1, false, 'open'],
  ['01213841571', 7213, 0, 25, 0, true, 'closed'], ['01282119655', 6536.32, 0, 1, 0, true, 'open'],
  ['01214523297', 0, 70, 0, 1, true, 'open'], ['01217783439', 0, 12599, 0, 2, true, 'closed'], ['01217783487', 0, 6990, 0, 1, false, 'open'],
].map(([w, tin, tout, cin, cout, reg, status]) => ({ w, tin, tout, cin, cout, reg, status }))

const money = (n) => `${Number(n || 0).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`
const usd = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function FullDashboard() {
  const { language, t } = useLanguage()
  const [page, setPage] = useState('dash')
  const [query, setQuery] = useState('')
  const [usdRate, setUsdRate] = useState(47.5)
  const [usdtRate, setUsdtRate] = useState(54.45)
  const [salary, setSalary] = useState(3500)
  const [extra, setExtra] = useState(() => Number(localStorage.getItem('ot_extra3') || 0))
  const [settled, setSettled] = useState(() => JSON.parse(localStorage.getItem('ot_settled3') || '{}'))
  const [walletRows, setWalletRows] = useState({})
  const [walletFilter, setWalletFilter] = useState('')

  const totals = useMemo(() => MERCH.reduce((a, [, key, count, gross, rate]) => ({ count: a.count + count, gross: a.gross + gross, commission: a.commission + gross * rate }), { count: 0, gross: 0, commission: 0 }), [])
  const expenses = Number(salary || 0) * Number(usdRate || 0) + Number(extra || 0)
  const profit = totals.commission - expenses

  function saveExtra(value) { const n = Number(value || 0); setExtra(n); localStorage.setItem('ot_extra3', String(n)) }
  function saveSettled(key, value) { const next = { ...settled, [key]: Number(value || 0) }; setSettled(next); localStorage.setItem('ot_settled3', JSON.stringify(next)) }
  async function openWallet(wallet) {
    setPage(`w-${wallet}`)
    if (walletRows[wallet]) return
    const { data } = await supabase.from('maven_transactions').select('tx_id, created_utc, amount, merchant, sender_name, sender_number, payment_method').or(`wallet.ilike.%${wallet}%,receiver_number.eq.${wallet}`).order('created_utc', { ascending: false }).limit(500)
    setWalletRows((current) => ({ ...current, [wallet]: data || [] }))
  }
  const shownWallets = WALLETS.filter(({ w }) => w.includes(query))
  const activeWallet = page.startsWith('w-') ? page.slice(2) : null
  const activeRows = (walletRows[activeWallet] || []).filter((row) => JSON.stringify(row).toLowerCase().includes(walletFilter.toLowerCase()))

  const title = page === 'dash' ? t('الداشبورد الرئيسي', 'Main dashboard') : page === 'settle' ? t('التسويات والأرباح', 'Settlement & P&L') : `${t('محفظة', 'Wallet')}: ${activeWallet}`
  return <div className="flex h-full min-h-0 flex-col bg-bg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Topbar title={title} subtitle={t('بيانات يوليو 2026 — 4,864 معاملة', 'July 2026 data — 4,864 transactions')} />
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <button className={`rounded-lg px-3 py-2 text-sm font-semibold ${page === 'dash' ? 'bg-gold/15 text-gold' : 'text-muted hover:bg-card'}`} onClick={() => setPage('dash')}>📊 {t('الداشبورد', 'Dashboard')}</button>
        <button className={`rounded-lg px-3 py-2 text-sm font-semibold ${page === 'settle' ? 'bg-gold/15 text-gold' : 'text-muted hover:bg-card'}`} onClick={() => setPage('settle')}>🏦 {t('التسويات والأرباح', 'Settlement & P&L')}</button>
        <div className="mr-auto flex items-center gap-2"><input className="ot-inline-search rounded-lg border border-border bg-card px-3 py-2 text-sm text-text" placeholder={t('بحث عن محفظة...', 'Search wallet...')} value={query} onChange={(e) => setQuery(e.target.value)} />{shownWallets.slice(0, 5).map((wallet) => <button key={wallet.w} title={wallet.w} onClick={() => openWallet(wallet.w)} className="hidden rounded-lg border border-border bg-card px-2 py-2 text-xs text-muted hover:border-gold hover:text-gold lg:block">{wallet.w}</button>)}</div>
      </div>
      {page === 'dash' && <Dashboard totals={totals} expenses={expenses} profit={profit} usdRate={usdRate} usdtRate={usdtRate} salary={salary} extra={extra} setUsdRate={setUsdRate} setUsdtRate={setUsdtRate} setSalary={setSalary} saveExtra={saveExtra} onWallet={openWallet} />}
      {page === 'settle' && <SettlementPage totals={totals} expenses={expenses} profit={profit} settled={settled} saveSettled={saveSettled} extra={extra} saveExtra={saveExtra} usdRate={usdRate} salary={salary} />}
      {activeWallet && <WalletPage wallet={WALLETS.find((item) => item.w === activeWallet)} rows={activeRows} filter={walletFilter} setFilter={setWalletFilter} loading={!walletRows[activeWallet]} />}
  </div>
}

function Dashboard({ totals, expenses, profit, usdRate, usdtRate, salary, extra, setUsdRate, setUsdtRate, setSalary, saveExtra, onWallet }) {
  return <section className="ot-page"><div className="ot-config"><Field label="USD/EGP" value={usdRate} set={setUsdRate} /><Field label="USDT/EGP" value={usdtRate} set={setUsdtRate} /><Field label="الراتب USD" value={salary} set={setSalary} /><Field label="مصاريف إضافية ج.م" value={extra} set={saveExtra} /></div><div className="ot-kpis"><Kpi label="إجمالي PayIn" value={money(totals.gross)} note={`${totals.count.toLocaleString()} عملية مدفوعة`} tone="gold" /><Kpi label="عمولات OnTarget" value={money(totals.commission)} note={`${usd(totals.commission / usdRate)} USD`} tone="green" /><Kpi label="المصاريف الكلية" value={money(expenses)} note={`راتب: ${salary} USD × ${usdRate}`} tone="red" /><Kpi label="صافي الربح" value={money(profit)} note={`${usd(profit / usdRate)} USD`} tone="orange" /><Kpi label="صادر المحافظ" value="745,265.00 ج.م" note="ext: 705,210 + قيود: 40,055" tone="blue" /></div><Section title="ملخص التجار"><MerchantTable totals={totals} /></Section><Section title="تسوية USDT المنفّذة"><div className="usdt"><b>EZInvest</b><span>31,000.00 ج.م</span><span>{usdtRate}</span><span>{(31000 / usdtRate).toFixed(4)} USDT</span><strong>{(31000 / usdtRate * .06).toFixed(4)} عمولة</strong><em>{(31000 / usdtRate * .94).toFixed(4)} صافي</em></div></Section><Section title="المحافظ — نقر للتفاصيل"><div className="wallet-list">{WALLETS.map((w) => <WalletCard key={w.w} wallet={w} onClick={onWallet} />)}</div></Section></section>
}

function SettlementPage({ totals, expenses, profit, settled, saveSettled, extra, saveExtra, usdRate, salary }) { return <section className="ot-page"><div className="ot-settle-grid"><Section title="تسويات التجار"><MerchantTable totals={totals} settlement settled={settled} saveSettled={saveSettled} /></Section><div className="ot-side-panels"><div className="ot-panel"><h3>📊 الأرباح والخسائر</h3><Row label="إجمالي العمولات" value={money(totals.commission)} tone="green" /><Row label={`الراتب (${salary} USD × ${usdRate})`} value={`- ${money(salary * usdRate)}`} tone="red" /><Row label="مصاريف إضافية" value={`- ${money(extra)}`} tone="red" /><Row label="إجمالي المصاريف" value={`- ${money(expenses)}`} tone="red" /><div className="net"><b>💎 صافي الربح</b><strong>{money(profit)}</strong></div><div className="owners"><span>مينا<br /><b>{money(profit * .4)}</b></span><span>إسلام<br /><b>{money(profit * .3)}</b></span><span>هشام<br /><b>{money(profit * .3)}</b></span></div></div><div className="ot-panel"><h3>💸 المصاريف</h3><Row label="الراتب" value={money(salary * usdRate)} tone="red" /><label className="expense-field">مصاريف إضافية ج.م<input type="number" value={extra} onChange={(e) => saveExtra(e.target.value)} /></label><div className="expense-total">{money(expenses)}</div></div></div></div></section> }

function MerchantTable({ totals, settlement = false, settled = {}, saveSettled }) { return <div className="ot-table-wrap"><table><thead><tr><th>التاجر</th><th>عدد</th><th>إجمالي ج.م</th><th>عمولة</th><th>عمولة OnTarget</th><th>صافي للتاجر</th>{settlement && <><th>محوّل ✏️</th><th>متبقي</th><th>حالة</th></>}</tr></thead><tbody>{MERCH.map(([short, key, count, gross, rate]) => { const commission = gross * rate; const net = gross - commission; const paid = Number(settled[key] || 0); const pending = Math.max(0, net - paid); return <tr key={key}><td><b>{short}</b><small>{key}</small></td><td>{count.toLocaleString()}</td><td className="gold">{money(gross)}</td><td>{(rate * 100).toFixed(0)}%</td><td className="green">{money(commission)}</td><td className="blue">{money(net)}</td>{settlement && <><td><input className="settled-input" type="number" value={paid || ''} onChange={(e) => saveSettled(key, e.target.value)} /></td><td className={pending ? 'red' : 'green'}>{money(pending)}</td><td><span className={`status ${pending ? paid ? 'partial' : 'pending' : 'paid'}`}>{pending ? paid ? 'جزئي' : 'معلّق' : 'مسوّى'}</span></td></>}</tr>})}<tr className="total"><td>الإجمالي</td><td>{totals.count.toLocaleString()}</td><td>{money(totals.gross)}</td><td>—</td><td>{money(totals.commission)}</td><td>{money(totals.gross - totals.commission)}</td></tr></tbody></table></div> }

function WalletPage({ wallet, rows, filter, setFilter, loading }) { if (!wallet) return null; return <section className="ot-page"><div className="wallet-head"><div><small>المحفظة</small><h1>{wallet.w}</h1><span className={`status ${wallet.reg ? 'paid' : 'partial'}`}>{wallet.reg ? '✅ مسجلة' : '⚠️ غير مسجلة'}</span></div><div className="wallet-stats"><span>الوارد <b>{money(wallet.tin)}</b></span><span>الصادر <b className="red">{money(wallet.tout)}</b></span><span>الصافي <b className="green">{money(wallet.tin - wallet.tout)}</b></span></div></div><Section title={`📥 الإيداعات — PayIn (${rows.length})`}><div className="ot-table-wrap"><div className="table-filter"><input placeholder="بحث في معاملات المحفظة..." value={filter} onChange={(e) => setFilter(e.target.value)} /></div>{loading ? <div className="empty">جارِ تحميل العمليات...</div> : rows.length === 0 ? <div className="empty">لا توجد معاملات مرتبطة بهذه المحفظة في المصدر الحالي.</div> : <table><thead><tr><th>رقم TX</th><th>التاريخ</th><th>التاجر</th><th>اسم المرسل</th><th>رقم المرسل</th><th>المبلغ</th><th>طريقة الدفع</th></tr></thead><tbody>{rows.map((row) => <tr key={row.tx_id}><td>{row.tx_id}</td><td>{row.created_utc ? new Date(row.created_utc).toLocaleString('en-GB') : '—'}</td><td>{row.merchant || '—'}</td><td>{row.sender_name || '—'}</td><td>{row.sender_number || '—'}</td><td className="gold">{money(row.amount)}</td><td>{row.payment_method || '—'}</td></tr>)}</tbody></table>}</div></Section></section> }

function Field({ label, value, set }) { return <label>{label}<input type="number" value={value} onChange={(e) => set(e.target.value)} /></label> }
function Kpi({ label, value, note, tone }) { return <div className={`kpi ${tone}`}><small>{label}</small><b>{value}</b><span>{note}</span></div> }
function WalletCard({ wallet, onClick }) { return <button className="wallet-card" onClick={() => onClick(wallet.w)}><div><b>{wallet.w}</b><small>{wallet.reg ? '✅ مسجلة' : '⚠️ غير مسجلة'}</small></div><span>وارد<strong>{money(wallet.tin)}</strong></span><span>صادر<strong className="red">{money(wallet.tout)}</strong></span><span>صافي<strong className="green">{money(wallet.tin - wallet.tout)}</strong></span><em>→ تفاصيل</em></button> }
function Section({ title, children }) { return <div className="ot-section-block"><h2><i />{title}</h2>{children}</div> }
function Row({ label, value, tone }) { return <div className="p-row"><span>{label}</span><b className={tone}>{value}</b></div> }
