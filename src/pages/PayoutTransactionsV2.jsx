import { useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import TablePagination from '../components/TablePagination'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatAbsoluteDate, formatMoney, formatNumber } from '../utils/format'

const dateOf = (row) => String(row.created_at || row.created_utc || row.paid_at || row.updated_at || '')
const phoneOf = (row) => row.client_phone || row.user_phone_number || row.sender_number || row.phone
const fields = ['Action', 'Transaction ID', 'Merchant Reference', 'Status', 'Payment Type', 'User Phone', 'Account Name', 'Account Number', 'Bank Name', 'Bank IFSC', 'UTR Number', 'Currency', 'Amount', 'Commission', 'Commission %', 'Master Merchant', 'Merchant', 'Sub Merchant', 'PayBy', 'Payout Type']

export default function PayoutTransactionsV2() {
  const [filters, setFilters] = useState({ from: '', to: '', merchant: '', status: '', payment: '', amount: '', search: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const query = useRealtimeTable({ key: ['payout-list-v2'], queryFn: async (sb) => sb.from('transactions').select('*').eq('trx_type', 'withdrawal').order('created_at', { ascending: false }).limit(10000), intervalMs: 15000 })
  const all = query.data || []
  const merchants = [...new Set(all.map((row) => row.merchant || row.merchant_name).filter(Boolean))].sort()
  const payments = [...new Set(all.map((row) => row.payment_method || row.payment_type).filter(Boolean))].sort()
  const rows = useMemo(() => all.filter((row) => {
    const date = dateOf(row).slice(0, 10)
    const term = filters.search.trim().toLowerCase()
    const text = [row.trx_id, row.merchant_reference, row.merchant, row.master_merchant, row.sub_merchant, phoneOf(row), row.user_account_name, row.user_account_number, row.bank_name, row.utr_number, row.amount].join(' ').toLowerCase()
    return (!filters.from || !date || date >= filters.from) && (!filters.to || !date || date <= filters.to) && (!filters.merchant || (row.merchant || row.merchant_name) === filters.merchant) && (!filters.status || String(row.status).toLowerCase() === filters.status.toLowerCase()) && (!filters.payment || (row.payment_method || row.payment_type) === filters.payment) && (!filters.amount || Number(row.amount) === Number(filters.amount)) && (!term || text.includes(term))
  }), [all, filters])
  const duplicateIds = useMemo(() => {
    const found = new Set()
    const sorted = [...rows].sort((a, b) => new Date(dateOf(a)) - new Date(dateOf(b)))
    sorted.forEach((row, index) => {
      const phone = phoneOf(row); const amount = Number(row.amount)
      if (!phone || !amount) return
      for (let previous = index - 1; previous >= 0; previous -= 1) {
        const other = sorted[previous]
        if (new Date(dateOf(row)) - new Date(dateOf(other)) > 30 * 60 * 1000) break
        if (phoneOf(other) === phone && Number(other.amount) === amount) { found.add(String(row.trx_id || row.id)); found.add(String(other.trx_id || other.id)) }
      }
    })
    return found
  }, [rows])
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize)
  const setFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1) }
  const clear = () => { setFilters({ from: '', to: '', merchant: '', status: '', payment: '', amount: '', search: '' }); setPage(1) }

  return <div className="flex h-full flex-col bg-bg">
    <Topbar title="💸 P2P Payout Transactions" subtitle="Maven and PayFuture · duplicate-risk warning included" onRefresh={query.refresh} isFetching={query.isFetching} />
    <div className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-[1900px] space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <Filter label="Date from"><input type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} /></Filter>
        <Filter label="Date to"><input type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} /></Filter>
        <Filter label="Merchant"><select value={filters.merchant} onChange={(event) => setFilter('merchant', event.target.value)}><option value="">All merchants</option>{merchants.map((item) => <option key={item}>{item}</option>)}</select></Filter>
        <Filter label="Status"><select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">All statuses</option>{['pending', 'approved', 'completed', 'rejected', 'PAID', 'DECLINED'].map((item) => <option key={item}>{item}</option>)}</select></Filter>
        <Filter label="Payment type"><select value={filters.payment} onChange={(event) => setFilter('payment', event.target.value)}><option value="">All payment types</option>{payments.map((item) => <option key={item}>{item}</option>)}</select></Filter>
        <Filter label="Amount"><input type="number" value={filters.amount} onChange={(event) => setFilter('amount', event.target.value)} /></Filter>
        <Filter label="Search by" wide><input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="TRX, phone, account, bank, UTR…" /></Filter>
        <button onClick={clear} className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-gold hover:text-gold">Clear filters</button>
      </div>
      <div className="flex justify-between text-xs text-muted"><span>Showing {formatNumber(rows.length)} of {formatNumber(all.length)}</span><span>⚠️ {formatNumber(duplicateIds.size)} duplicate-risk rows</span></div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-[1800px] text-xs"><thead className="bg-surface text-muted"><tr>{fields.map((field) => <th key={field} className="whitespace-nowrap p-3 text-left">{field}</th>)}</tr></thead><tbody>
        {visibleRows.map((row) => { const id = String(row.trx_id || row.id); const duplicate = duplicateIds.has(id); return <tr key={id} className={`border-t border-border ${duplicate ? 'bg-warning/10' : 'hover:bg-gold/5'}`}><td className="p-3"><a href={`/payouts?trx_id=${id}`} className="rounded border border-border px-2 py-1 text-gold">View</a></td><td className="p-3 font-mono font-bold text-gold">{duplicate && <span className="mr-1" title="Possible duplicate">⚠️</span>}{id}</td><td className="p-3 font-mono">{row.merchant_reference || row.external_id || '—'}</td><td className="p-3">{row.status || '—'}</td><td className="p-3">{row.payment_method || row.payment_type || '—'}</td><td className="p-3 font-mono">{phoneOf(row) || '—'}</td><td className="p-3">{row.user_account_name || row.client_name || row.sender_name || '—'}</td><td className="p-3 font-mono">{row.user_account_number || row.account_number || row.wallet_number || '—'}</td><td className="p-3">{row.bank_name || '—'}</td><td className="p-3">{row.bank_ifsc || row.ifsc || '—'}</td><td className="p-3 font-mono">{row.utr_number || row.utr || row.external_id || '—'}</td><td className="p-3">{row.currency || 'EGP'}</td><td className="p-3 font-bold">{formatMoney(row.amount)}</td><td className="p-3">{formatMoney(row.commission)}</td><td className="p-3">{row.commission_percent ?? row.commission_pct ?? '—'}</td><td className="p-3">{row.master_merchant || '—'}</td><td className="p-3">{row.merchant || row.merchant_name || '—'}</td><td className="p-3">{row.sub_merchant || '—'}</td><td className="p-3">{row.payby || row.pay_by || '—'}</td><td className="p-3">{row.payout_type || row.trx_type || '—'}<div className="text-muted">{formatAbsoluteDate(dateOf(row))}</div></td></tr> })}
      </tbody></table><TablePagination total={rows.length} page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />{query.error && <div className="p-10 text-center text-danger">Unable to load payout transactions: {query.error.message}</div>}{!query.isFetching && !rows.length && !query.error && <div className="p-10 text-center text-muted">No data available in table.</div>}</div>
    </div></div>
  </div>
}

function Filter({ label, children, wide = false }) { return <label className={`${wide ? 'min-w-[260px] flex-1' : 'min-w-[130px]'} text-xs text-muted`}>{label}<span className="mt-1 block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-border [&_input]:bg-surface [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:text-text [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-border [&_select]:bg-surface [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm [&_select]:text-text">{children}</span></label> }
