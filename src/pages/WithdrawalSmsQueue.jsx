import { useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import DataTable from '../components/DataTable'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatAbsoluteDate, formatMoney, formatNumber } from '../utils/format'
import { smsAmountOf } from '../utils/smsAmount'

const walletOf = (row) => row.confirmed_wallet_number || row.wallet || row.receiver_number || row.wallet_name
const bodyOf = (row) => String(row.message || row.raw_sms || row.sms_first_line || '')
const needsCorrection = (row) => !row.consumed_by_tx_id || !walletOf(row) || (!row.device_name && !row.sim_slot)

export default function WithdrawalSmsQueue() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const query = useRealtimeTable({ key: ['withdrawal-sms-queue'], queryFn: async (sb) => sb.from('inbound_sms').select('*').eq('sms_category', 'withdrawal').order('received_at', { ascending: false }).limit(10000), intervalMs: 10000 })
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (query.data || []).filter((row) => {
      const date = String(row.received_at || '').slice(0, 10)
      const text = [row.id, smsAmountOf(row), row.sender_name, row.sender_number, walletOf(row), row.device_name, row.sim_slot, row.trx_id, row.trx_reference, row.consumed_by_tx_id].join(' ').toLowerCase()
      return (filter === 'all' || needsCorrection(row)) && (!from || date >= from) && (!to || date <= to) && (!term || text.includes(term))
    })
  }, [query.data, filter, search, from, to])
  const columns = [
    { key: 'id', label: 'SMS ID', render: (row) => <span className="font-mono text-gold">#{row.id}</span> },
    { key: 'amount', label: 'Amount', render: (row) => <b className="text-danger">{formatMoney(smsAmountOf(row))}</b> },
    { key: 'sender', label: 'Sender', render: (row) => <span>{row.sender_name || '—'}<span className="block font-mono text-xs text-muted">{row.sender_number || '—'}</span></span> },
    { key: 'wallet', label: 'Wallet', render: (row) => <span className="font-mono">{walletOf(row) || '⚠️ Not mapped'}</span> },
    { key: 'body', label: 'SMS body', render: (row) => <details><summary className="max-w-[280px] cursor-pointer truncate text-xs text-muted">{bodyOf(row) || 'Show body'}</summary><pre className="mt-2 max-h-48 max-w-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-2 text-[10px] text-text">{bodyOf(row) || '—'}</pre></details> },
    { key: 'device', label: 'Device / SIM', render: (row) => `${row.device_name || '—'}${row.sim_slot ? ` · SIM ${row.sim_slot}` : ''}` },
    { key: 'trx', label: 'Linked TRX', render: (row) => row.consumed_by_tx_id || row.matched_transaction_id || row.maven_transaction_id || '—' },
    { key: 'status', label: 'Action status', render: (row) => needsCorrection(row) ? <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-bold text-warning">Needs confirmation/correction</span> : <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-bold text-success">Linked</span> },
    { key: 'received_at', label: 'Time', render: (row) => formatAbsoluteDate(row.received_at) },
  ]
  const pending = rows.filter(needsCorrection).length
  const totalAmount = rows.reduce((sum, row) => sum + smsAmountOf(row), 0)
  function exportCsv() { const header = ['SMS ID', 'Amount', 'Sender name', 'Sender phone', 'Wallet', 'Device', 'SIM', 'Linked TRX', 'Status', 'Time']; const body = rows.map((row) => [row.id, smsAmountOf(row), row.sender_name || '', row.sender_number || '', walletOf(row) || '', row.device_name || '', row.sim_slot || '', row.consumed_by_tx_id || row.matched_transaction_id || row.maven_transaction_id || '', needsCorrection(row) ? 'Needs action' : 'Linked', row.received_at || '']); const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `withdrawal-sms-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url) }
  function exportPdf() { const table = rows.map((row) => `<tr><td>${row.id}</td><td>${smsAmountOf(row)}</td><td>${row.sender_name || ''}</td><td>${row.sender_number || ''}</td><td>${walletOf(row) || ''}</td><td>${row.device_name || ''}</td><td>${row.received_at || ''}</td></tr>`).join(''); const win = window.open('', '_blank'); if (!win) return; win.document.write(`<html><head><title>Withdrawal SMS</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left;font-size:11px}</style></head><body><h2>Withdrawal SMS (${rows.length})</h2><table><thead><tr><th>SMS</th><th>Amount</th><th>Sender</th><th>Phone</th><th>Wallet</th><th>Device</th><th>Time</th></tr></thead><tbody>${table}</tbody></table></body></html>`); win.document.close(); win.print() }
  return <div className="flex h-full flex-col bg-bg"><Topbar title="💸 Withdrawal SMS" subtitle="All withdrawal SMS · confirmation and wallet/SIM correction queue" onRefresh={query.refresh} isFetching={query.isFetching} /><div className="flex-1 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-[1800px] space-y-5"><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Filtered withdrawal SMS" value={formatNumber(rows.length)} /><Stat label="Needs action" value={formatNumber(pending)} tone="text-warning" /><Stat label="Linked" value={formatNumber(rows.length - pending)} tone="text-success" /><Stat label="Filtered amount" value={formatMoney(totalAmount)} tone="text-danger" /></div><div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-4"><label className="text-xs text-muted">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /></label><label className="text-xs text-muted">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /></label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SMS, sender, wallet, TRX…" className="min-w-[260px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"><option value="all">All withdrawal SMS</option><option value="needs">Needs confirmation / wallet-SIM correction</option></select><button onClick={exportCsv} className="rounded-lg border border-border px-3 py-2 text-sm text-gold hover:border-gold">⬇ CSV</button><button onClick={exportPdf} className="rounded-lg bg-gold px-3 py-2 text-sm font-bold text-bg">🖨 PDF</button></div><DataTable columns={columns} data={rows} loading={query.isLoading} error={query.error} columnStorageKey="withdrawal-sms" emptyEmoji="💸" emptyTitle="No withdrawal SMS" emptySubtitle="Withdrawal SMS received from Maven will appear here." /></div></div></div>
}

function Stat({ label, value, tone = 'text-gold' }) { return <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted">{label}</div><div className={`mt-2 text-xl font-black ${tone}`}>{value}</div></div> }
