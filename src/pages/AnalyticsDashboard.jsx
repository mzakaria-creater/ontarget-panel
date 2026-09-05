import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444']

const fallbackTransactions = Array.from({ length: 20 }, (_, index) => ({
  id: `TXN-${String(index + 1).padStart(6, '0')}`,
  date: new Date(Date.now() - index * 86400000).toISOString(),
  method: ['Vodafone Cash', 'InstaPay', 'Bank Transfer', 'Fawry Pay'][index % 4],
  amount: 1000 + index * 2750,
  status: ['PAID', 'PENDING', 'DECLINED'][index % 3],
  customerName: ['Ahmed Ali', 'Fatima Hassan', 'Mohamed Omar'][index % 3],
}))

function normalizeTransaction(row) {
  return {
    id: row.tx_id || row.id || '—',
    date: row.created_utc || row.tx_time || row.created_at,
    method: row.payment_method || row.method || '—',
    amount: Number(row.amount) || 0,
    status: row.status || 'UNKNOWN',
    customerName: row.sender_name || row.customer_name || '—',
    masterMerchant: row.master_merchant || '—',
  }
}

const currency = (amount) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(amount || 0)

export default function AnalyticsDashboard() {
  const { showToast } = useToast()
  const [view, setView] = useState('chart')
  const [transactions, setTransactions] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [masterFilter, setMasterFilter] = useState([])
  const [methodFilter, setMethodFilter] = useState([])
  const [statusFilter, setStatusFilter] = useState([])

  async function loadData() {
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('maven_transactions')
      .select('tx_id, created_utc, payment_method, amount, status, sender_name, master_merchant')
      .order('created_utc', { ascending: false })
      .limit(200)

    if (queryError) {
      setError(queryError.message)
      setTransactions(fallbackTransactions)
      showToast('تعذر تحميل البيانات الحية، تم عرض بيانات تجريبية', 'error')
    } else {
      setTransactions((data || []).map(normalizeTransaction))
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return transactions.filter((tx) => {
      const matchesSearch = [tx.id, tx.method, tx.customerName, tx.status, tx.masterMerchant].some((value) => String(value).toLowerCase().includes(term))
      return matchesSearch && (!masterFilter.length || masterFilter.includes(tx.masterMerchant)) && (!methodFilter.length || methodFilter.includes(tx.method)) && (!statusFilter.length || statusFilter.includes(tx.status))
    })
  }, [transactions, search, masterFilter, methodFilter, statusFilter])

  const stats = useMemo(() => {
    const totalVolume = filtered.reduce((sum, tx) => sum + tx.amount, 0)
    const completed = filtered.filter((tx) => ['PAID', 'COMPLETED', 'SUCCEEDED'].includes(String(tx.status).toUpperCase()))
    const failed = filtered.filter((tx) => ['DECLINED', 'FAILED'].includes(String(tx.status).toUpperCase()))
    return { totalTransactions: filtered.length, totalVolume, successRate: filtered.length ? completed.length / filtered.length * 100 : 0, avgTransaction: filtered.length ? totalVolume / filtered.length : 0, failedTransactions: failed.length }
  }, [filtered])

  const dailyData = useMemo(() => {
    const grouped = {}
    filtered.forEach((tx) => {
      const day = tx.date ? new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'
      grouped[day] = (grouped[day] || 0) + 1
    })
    return Object.entries(grouped).reverse().slice(-14).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const methodData = useMemo(() => {
    const grouped = {}
    filtered.forEach((tx) => { grouped[tx.method] = (grouped[tx.method] || 0) + 1 })
    return Object.entries(grouped).map(([name, value]) => ({ name, value }))
  }, [filtered])

  function exportCsv() {
    const csv = ['Transaction ID,Date,Method,Amount,Status', ...filtered.map((tx) => [tx.id, tx.date, tx.method, tx.amount, tx.status].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = 'ontarget-transactions.csv'
    link.click()
    URL.revokeObjectURL(link.href)
    showToast('تم تصدير المعاملات', 'success')
  }

  const badgeClass = (status) => {
    const normalized = String(status).toUpperCase()
    if (['PAID', 'COMPLETED', 'SUCCEEDED'].includes(normalized)) return 'bg-success/15 text-success'
    if (['PENDING'].includes(normalized)) return 'bg-warning/15 text-warning'
    if (['DECLINED', 'FAILED'].includes(normalized)) return 'bg-danger/15 text-danger'
    return 'bg-border text-muted'
  }

  return (
    <div dir="ltr" className="h-full overflow-y-auto bg-bg p-6 text-text">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold">Executive Dashboard</h1><p className="mt-1 text-sm text-muted">Multi-filtered transaction analytics and insights</p></div>
          <div className="flex items-center gap-3"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions..." className="w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-gold" /><button onClick={loadData} disabled={loading} className="rounded-lg border border-border bg-card p-2 hover:border-gold disabled:opacity-50">↻</button></div>
        </header>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
          <MultiSelect label="Master merchant" values={masterFilter} options={[...new Set(transactions.map((tx) => tx.masterMerchant))].filter((value) => value !== '—').sort()} onChange={setMasterFilter} />
          <MultiSelect label="Payment method" values={methodFilter} options={[...new Set(transactions.map((tx) => tx.method))].sort()} onChange={setMethodFilter} />
          <MultiSelect label="Status" values={statusFilter} options={[...new Set(transactions.map((tx) => tx.status))].sort()} onChange={setStatusFilter} />
          {(masterFilter.length || methodFilter.length || statusFilter.length || search) ? <button onClick={() => { setMasterFilter([]); setMethodFilter([]); setStatusFilter([]); setSearch('') }} className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-gold hover:text-gold">Clear filters</button> : null}
          <span className="ml-auto text-xs text-muted">{filtered.length} / {transactions.length} transactions</span>
          {['chart', 'table', 'pivot'].map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === item ? 'bg-gold text-bg' : 'text-muted hover:bg-surface hover:text-text'}`}>{item === 'chart' ? '▦ Charts' : item === 'table' ? '☷ Table' : '⟳ Pivot'}</button>)}
          <span className="mx-2 h-6 w-px bg-border" /><button onClick={exportCsv} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface hover:text-text">⇩ Export</button>
        </div>

        {error && <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[['Total Transactions', stats.totalTransactions.toLocaleString(), 'text-gold'], ['Total Volume', currency(stats.totalVolume), 'text-cyan-400'], ['Success Rate', `${stats.successRate.toFixed(1)}%`, 'text-success'], ['Avg Transaction', currency(stats.avgTransaction), 'text-violet-400'], ['Failed Txns', stats.failedTransactions, 'text-danger']].map(([label, value, tone]) => <div key={label} className="rounded-xl border border-border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p><p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p></div>)}
        </div>

        {view === 'chart' && <div className="space-y-6"><div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div className="rounded-xl border border-border bg-card p-5"><h2 className="mb-4 font-bold">Daily Transactions</h2><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} /><XAxis dataKey="name" stroke="#6b7280" fontSize={12} /><YAxis stroke="#6b7280" fontSize={12} /><Tooltip contentStyle={{ background: '#13161e', border: '1px solid #1e2535' }} /><Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div><div className="rounded-xl border border-border bg-card p-5"><h2 className="mb-4 font-bold">Payment Methods</h2><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={methodData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>{methodData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: '#13161e', border: '1px solid #1e2535' }} /><Legend /></PieChart></ResponsiveContainer></div></div></div><TransactionTable rows={filtered.slice(0, 10)} badgeClass={badgeClass} /></div>}
        {view === 'table' && <TransactionTable rows={filtered} badgeClass={badgeClass} />}
        {view === 'pivot' && <PivotTable transactions={filtered} />}
      </div>
    </div>
  )
}

function MultiSelect({ label, values, options, onChange }) {
  return <label className="text-xs text-muted"><span className="mb-1 block">{label} <span className="text-gold">{values.length ? `(${values.length})` : ''}</span></span><select multiple value={values} onChange={(event) => onChange([...event.target.selectedOptions].map((option) => option.value))} className="min-w-44 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text" size={Math.min(Math.max(options.length, 2), 4)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function TransactionTable({ rows, badgeClass }) {
  return <div className="overflow-x-auto rounded-xl border border-border bg-card"><div className="border-b border-border p-5 font-bold">All Transactions <span className="ml-2 text-xs font-normal text-muted">{rows.length} rows</span></div><table className="w-full text-left text-sm"><thead className="bg-surface text-xs uppercase text-muted"><tr>{['ID', 'Date', 'Method', 'Customer', 'Amount', 'Status'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody>{rows.map((tx) => <tr key={tx.id} className="border-t border-border hover:bg-surface"><td className="px-4 py-3 font-mono text-violet-400">{tx.id}</td><td className="px-4 py-3 text-muted">{tx.date ? new Date(tx.date).toLocaleDateString() : '—'}</td><td className="px-4 py-3">{tx.method}</td><td className="px-4 py-3 text-muted">{tx.customerName}</td><td className="px-4 py-3 font-bold">{currency(tx.amount)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(tx.status)}`}>{tx.status}</span></td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-muted">No transactions found</p>}</div>
}

function PivotTable({ transactions }) {
  const groups = Object.entries(transactions.reduce((result, tx) => { result[tx.method] = (result[tx.method] || 0) + tx.amount; return result }, {}))
  return <div className="rounded-xl border border-border bg-card p-5"><h2 className="mb-4 font-bold">Payment Methods Summary</h2><table className="w-full text-left text-sm"><thead className="bg-surface text-xs uppercase text-muted"><tr><th className="px-4 py-3">Method</th><th className="px-4 py-3">Transactions</th><th className="px-4 py-3">Volume</th></tr></thead><tbody>{groups.map(([method, volume]) => <tr key={method} className="border-t border-border"><td className="px-4 py-3">{method}</td><td className="px-4 py-3">{transactions.filter((tx) => tx.method === method).length}</td><td className="px-4 py-3 font-bold text-gold">{currency(volume)}</td></tr>)}</tbody></table></div>
}
