import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

const COLORS = ['#ef4444', '#6366f1', '#3b82f6', '#10b981', '#f59e0b']
const fallback = Array.from({ length: 40 }, (_, i) => ({ tx_id: `TXN-${String(i + 1).padStart(6, '0')}`, created_utc: new Date(Date.now() - i * 86400000 / 2).toISOString(), payment_method: ['Vodafone Cash', 'InstaPay', 'Bank Transfer', 'Meeza', 'Fawry'][i % 5], amount: 18000 + i * 1300, status: i % 7 === 0 ? 'DECLINED' : 'PAID', sender_name: ['Alpha Electronics', 'Beta Commerce', 'Delta Payments', 'Gamma Digital'][i % 4] }))

function money(value) { return `EGP ${Math.round(value || 0).toLocaleString('en-EG')}` }

export default function AnalyticsPage() {
  const { showToast } = useToast()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    const { data, error } = await supabase.from('maven_transactions').select('tx_id, created_utc, payment_method, amount, status, sender_name').order('created_utc', { ascending: true }).limit(1000)
    if (error) { setTransactions(fallback); showToast('تعذر تحميل البيانات الحية، تم عرض بيانات بديلة', 'error') } else setTransactions(data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const metrics = useMemo(() => {
    const revenue = transactions.filter((tx) => String(tx.status).toUpperCase() === 'PAID').reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    const failed = transactions.filter((tx) => ['DECLINED', 'FAILED'].includes(String(tx.status).toUpperCase())).length
    return { revenue, fees: revenue * 0.025, txns: transactions.length, avg: transactions.length ? revenue / transactions.length : 0, failed }
  }, [transactions])

  const monthly = useMemo(() => {
    const groups = {}
    transactions.forEach((tx) => { const month = new Date(tx.created_utc).toLocaleDateString('en-US', { month: 'short' }); groups[month] ||= { month, revenue: 0, fees: 0 }; if (String(tx.status).toUpperCase() === 'PAID') { groups[month].revenue += Number(tx.amount || 0); groups[month].fees += Number(tx.amount || 0) * 0.025 } })
    return Object.values(groups)
  }, [transactions])

  const hourly = useMemo(() => { const groups = Array.from({ length: 24 }, (_, hour) => ({ hour: `${String(hour).padStart(2, '0')}:00`, volume: 0 })); transactions.forEach((tx) => { const hour = new Date(tx.created_utc).getHours(); groups[hour].volume += Number(tx.amount || 0) }); return groups }, [transactions])
  const methods = useMemo(() => { const groups = {}; transactions.forEach((tx) => { const key = tx.payment_method || 'Unknown'; groups[key] = (groups[key] || 0) + Number(tx.amount || 0) }); const total = Object.values(groups).reduce((a, b) => a + b, 0) || 1; return Object.entries(groups).map(([name, amount], index) => ({ name, amount, value: Math.round(amount / total * 100), color: COLORS[index % COLORS.length] })) }, [transactions])
  const merchants = useMemo(() => { const groups = {}; transactions.forEach((tx) => { const name = tx.sender_name || 'Unknown'; groups[name] ||= { name, volume: 0, txns: 0 }; groups[name].volume += Number(tx.amount || 0); groups[name].txns += 1 }); return Object.values(groups).sort((a, b) => b.volume - a.volume).slice(0, 5) }, [transactions])

  return <div className="h-full overflow-y-auto bg-[#f8fafc] p-6 text-slate-900"><div className="mx-auto max-w-[1500px] space-y-6 pb-10">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold">التحليلات</h1><p className="mt-1 text-sm text-slate-500">رؤى عميقة في أداء المدفوعات</p></div><div className="flex items-center gap-2"><button onClick={loadData} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">{loading ? 'جاري التحديث...' : '↻ تحديث'}</button><button onClick={() => showToast('استخدم تصدير صفحة التحليلات من التقرير الشامل', 'success')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">⇩ تصدير</button></div></div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[['إجمالي الإيرادات', money(metrics.revenue), 'from-indigo-500 to-violet-500'], ['إجمالي الرسوم', money(metrics.fees), 'from-emerald-500 to-teal-500'], ['المعاملات', metrics.txns.toLocaleString(), 'from-amber-500 to-orange-500'], ['متوسط القيمة', money(metrics.avg), 'from-rose-500 to-pink-500']].map(([title, value, gradient]) => <div key={title} className="rounded-2xl bg-white p-5 shadow-sm"><div className={`mb-3 h-10 w-10 rounded-xl bg-gradient-to-br ${gradient}`} /><p className="text-xs text-slate-500">{title}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>
    <div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-semibold">نظرة عامة على الإيرادات</h2><p className="mb-4 text-sm text-slate-500">تفصيل الإيرادات والرسوم الشهرية</p><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="month" stroke="#94a3b8" /><YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}K`} /><Tooltip formatter={(value) => money(value)} /><Legend /><Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} name="الإيرادات" /><Bar dataKey="fees" fill="#a5b4fc" radius={[6, 6, 0, 0]} name="الرسوم" /></BarChart></ResponsiveContainer></div></div>
    <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-semibold">النشاط حسب الساعة</h2><p className="mb-4 text-sm text-slate-500">حجم المعاملات حسب الساعة</p><div className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourly}><defs><linearGradient id="analytics-performance-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="hour" interval={3} stroke="#94a3b8" /><YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}K`} /><Tooltip formatter={(value) => money(value)} /><Area type="monotone" dataKey="volume" stroke="#10b981" fill="url(#analytics-performance-gradient)" name="الحجم" /></AreaChart></ResponsiveContainer></div></div><div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-semibold">طرق الدفع</h2><p className="mb-4 text-sm text-slate-500">التوزيع حسب طريقة الدفع</p><div className="flex h-[240px] items-center gap-4"><ResponsiveContainer width="55%" height="100%"><PieChart><Pie data={methods} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>{methods.map((entry) => <Cell key={entry.name} fill={entry.color} stroke="none" />)}</Pie><Tooltip formatter={(value) => `${value}%`} /></PieChart></ResponsiveContainer><div className="flex-1 space-y-3">{methods.map((method) => <div key={method.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full" style={{ backgroundColor: method.color }} />{method.name}</span><b>{method.value}%</b></div>)}</div></div></div></div>
    <div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-semibold">أفضل التجار</h2><p className="mb-4 text-sm text-slate-500">مرتبين حسب حجم المعاملات</p><div className="space-y-3">{merchants.map((merchant, index) => <div key={merchant.name} className="flex items-center gap-4 rounded-xl bg-slate-50 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700">#{index + 1}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{merchant.name}</p><p className="text-xs text-slate-500">{merchant.txns.toLocaleString()} معاملة</p></div><p className="text-sm font-bold">{money(merchant.volume)}</p></div>)}</div></div>
  </div></div>
}
