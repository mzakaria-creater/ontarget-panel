import { useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import DataTable from '../components/DataTable'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatAbsoluteDate, formatMoney, formatNumber } from '../utils/format'

const walletOf = (row) => row.confirmed_wallet_number || row.wallet || row.receiver_number || row.wallet_name
const needsCorrection = (row) => !row.consumed_by_tx_id || !walletOf(row) || (!row.device_name && !row.sim_slot)

export default function WithdrawalSmsQueue() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const query = useRealtimeTable({ key: ['withdrawal-sms-queue'], queryFn: async (sb) => sb.from('inbound_sms').select('*').eq('sms_category', 'withdrawal').order('received_at', { ascending: false }).limit(10000), intervalMs: 10000 })
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (query.data || []).filter((row) => {
      const text = [row.id, row.amount, row.sender_name, row.sender_number, walletOf(row), row.device_name, row.sim_slot, row.trx_id, row.trx_reference, row.consumed_by_tx_id].join(' ').toLowerCase()
      return (filter === 'all' || needsCorrection(row)) && (!term || text.includes(term))
    })
  }, [query.data, filter, search])
  const columns = [
    { key: 'id', label: 'SMS ID', render: (row) => <span className="font-mono text-gold">#{row.id}</span> },
    { key: 'amount', label: 'Amount', render: (row) => <b className="text-danger">{formatMoney(row.amount)}</b> },
    { key: 'sender', label: 'Sender', render: (row) => <span>{row.sender_name || '—'}<span className="block font-mono text-xs text-muted">{row.sender_number || '—'}</span></span> },
    { key: 'wallet', label: 'Wallet', render: (row) => <span className="font-mono">{walletOf(row) || '⚠️ Not mapped'}</span> },
    { key: 'device', label: 'Device / SIM', render: (row) => `${row.device_name || '—'}${row.sim_slot ? ` · SIM ${row.sim_slot}` : ''}` },
    { key: 'trx', label: 'Linked TRX', render: (row) => row.consumed_by_tx_id || row.matched_transaction_id || row.maven_transaction_id || '—' },
    { key: 'status', label: 'Action status', render: (row) => needsCorrection(row) ? <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-bold text-warning">Needs confirmation/correction</span> : <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-bold text-success">Linked</span> },
    { key: 'received_at', label: 'Time', render: (row) => formatAbsoluteDate(row.received_at) },
  ]
  const allRows = query.data || []
  const pending = allRows.filter(needsCorrection).length
  return <div className="flex h-full flex-col bg-bg"><Topbar title="💸 Withdrawal SMS" subtitle="All withdrawal SMS · confirmation and wallet/SIM correction queue" onRefresh={query.refresh} isFetching={query.isFetching} /><div className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-[1800px] space-y-5"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="All withdrawal SMS" value={formatNumber(allRows.length)} /><Stat label="Needs action" value={formatNumber(pending)} tone="text-warning" /><Stat label="Linked" value={formatNumber(allRows.length - pending)} tone="text-success" /><Stat label="Total amount" value={formatMoney(allRows.reduce((sum, row) => sum + Number(row.amount || 0), 0))} tone="text-danger" /></div><div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SMS, sender, wallet, TRX…" className="min-w-[260px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"><option value="all">All withdrawal SMS</option><option value="needs">Needs confirmation / wallet-SIM correction</option></select></div><DataTable columns={columns} data={rows} loading={query.isLoading} error={query.error} columnStorageKey="withdrawal-sms" emptyEmoji="💸" emptyTitle="No withdrawal SMS" emptySubtitle="Withdrawal SMS received from Maven will appear here." /></div></div></div>
}

function Stat({ label, value, tone = 'text-gold' }) { return <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted">{label}</div><div className={`mt-2 text-xl font-black ${tone}`}>{value}</div></div> }
