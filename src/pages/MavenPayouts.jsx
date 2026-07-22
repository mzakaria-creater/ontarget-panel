import { useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { formatAbsoluteDate, formatMoney, formatNumber } from '../utils/format'

const rawOf = (row) => row.maven_raw_row && typeof row.maven_raw_row === 'object' ? row.maven_raw_row : row.raw && typeof row.raw === 'object' ? row.raw : {}
const isPayout = (row) => ['withdrawal', 'payout', 'p2p_payout', 'p2p payout'].includes(String(row.trx_type || row.transaction_type || row.payout_type || '').toLowerCase())

export default function MavenPayouts() {
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [editing, setEditing] = useState(null)
  const [rawText, setRawText] = useState('')
  const [walletNumber, setWalletNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const query = useRealtimeTable({ key: ['maven-payout-raw'], queryFn: async (sb) => sb.from('maven_transactions').select('*').order('created_utc', { ascending: false }).limit(5000), intervalMs: 15000 })
  const all = useMemo(() => (query.data || []).filter(isPayout), [query.data])
  const rows = useMemo(() => all.filter((row) => {
    const term = search.trim().toLowerCase()
    const text = [row.tx_id, row.status, row.amount, row.sender_name, row.sender_number, row.to_account_number, row.payment_method, row.merchant, row.master_merchant, row.sub_merchant, row.external_id].join(' ').toLowerCase()
    return (!status || String(row.status || '').toLowerCase() === status.toLowerCase()) && (!term || text.includes(term))
  }), [all, search, status])
  const walletOptions = useMemo(() => [...new Set(all.flatMap((row) => [row.to_account_number, row.wallet_number, row.wallet].filter(Boolean).map(String)))].sort(), [all])
  const openRaw = (row) => { const current = String(row.to_account_number || row.wallet_number || row.wallet || ''); const selectedWallet = window.prompt(`Wallet number correction. Choose/type one:\n${walletOptions.join('\n')}`, current); setEditing(row); setWalletNumber(selectedWallet === null ? current : selectedWallet.trim()); setRawText(JSON.stringify(rawOf(row), null, 2)) }
  const toggle = (key) => setSelected((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next })
  const toggleAll = (checked) => setSelected((current) => {
    if (checked) return new Set([...current, ...rows.map((row) => String(row.tx_id))])
    return new Set([...current].filter((key) => !rows.some((row) => String(row.tx_id) === key)))
  })
  async function saveRaw() {
    if (!editing) return
    let parsed
    try { parsed = JSON.parse(rawText) } catch { showToast('Raw JSON غير صالح', 'error'); return }
    if (walletNumber) parsed.to_account_number = walletNumber
    setBusy(true)
    const result = await supabase.from('maven_transactions').update({ raw: parsed, maven_raw_row: parsed, ...(walletNumber ? { to_account_number: walletNumber } : {}) }).eq('tx_id', editing.tx_id)
    if (!result.error) await supabase.from('maven_transaction_history').insert({ tx_id: editing.tx_id, status: editing.status, amount: editing.amount, raw: { action: 'edit_full_raw', performed_by: 'Manual', occurred_at: new Date().toISOString() }, source: 'dashboard', status_changed: false })
    setBusy(false)
    if (result.error) { showToast(`فشل حفظ raw: ${result.error.message}`, 'error'); return }
    showToast('تم تعديل raw بنجاح', 'success'); setEditing(null); query.refresh()
  }
  async function removeRaw(rowsToClear) {
    if (!rowsToClear.length || !window.confirm(`حذف raw من OnTarget لعدد ${rowsToClear.length} معاملة؟ لن يتم حذفها من Maven.`)) return
    setBusy(true); let done = 0
    for (const row of rowsToClear) {
      const result = await supabase.from('maven_transactions').update({ raw: null, maven_raw_row: null }).eq('tx_id', row.tx_id)
      if (!result.error) { done += 1; await supabase.from('maven_transaction_history').insert({ tx_id: row.tx_id, status: row.status, amount: row.amount, raw: { action: 'remove_raw_from_ontarget', performed_by: 'Manual', occurred_at: new Date().toISOString() }, source: 'dashboard', status_changed: false }) }
    }
    setBusy(false); setSelected(new Set()); showToast(`تم حذف raw من OnTarget: ${done}/${rowsToClear.length}`, done === rowsToClear.length ? 'success' : 'error'); query.refresh()
  }
  const columns = [
    { key: 'tx_id', label: 'TRX ID', render: (row) => <span className="font-mono font-bold text-gold">{row.tx_id}</span> },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status} /> },
    { key: 'amount', label: 'Amount', render: (row) => <b>{formatMoney(row.amount)}</b> },
    { key: 'sender', label: 'Client / Sender phone', render: (row) => <span>{row.sender_name || row.sender_number || '—'}</span> },
    { key: 'payment_method', label: 'Payment', render: (row) => row.payment_method || row.payout_type || 'Maven Payout' },
    { key: 'merchant', label: 'Merchant', render: (row) => row.master_merchant ? `${row.master_merchant} · ${row.merchant || ''}` : row.merchant || '—' },
    { key: 'raw', label: 'Raw', render: (row) => <span className={Object.keys(rawOf(row)).length ? 'text-success' : 'text-muted'}>{Object.keys(rawOf(row)).length ? 'Available' : 'Empty'}</span> },
    { key: 'created_utc', label: 'Time', render: (row) => <span className="text-xs text-muted">{formatAbsoluteDate(row.created_utc || row.updated_at)}</span> },
    { key: 'action', label: 'Action', render: (row) => <button onClick={(event) => { event.stopPropagation(); openRaw(row) }} className="rounded-lg border border-gold/40 px-3 py-1.5 text-xs font-bold text-gold hover:bg-gold/10">Edit raw</button> },
  ]
  return <div className="flex h-full flex-col bg-bg"><Topbar title="💸 Maven Payout TRX + Raw" subtitle="Fetched payout transactions, raw editor and safe mass actions" onRefresh={query.refresh} isFetching={query.isFetching} /><div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6"><div className="mx-auto max-w-[1700px] space-y-5"><div className="rounded-2xl border border-gold/25 bg-gold/5 p-4 text-sm text-muted">Maven payout rows are read from OnTarget's fetched <b className="text-text">maven_transactions</b> table. Editing and removing raw affects OnTarget only; it does not delete the original record at Maven.</div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Maven payout TRX" value={formatNumber(all.length)} /><Stat label="Filtered" value={formatNumber(rows.length)} /><Stat label="Selected" value={formatNumber(selected.size)} /><Stat label="With raw" value={formatNumber(all.filter((row) => Object.keys(rawOf(row)).length).length)} /></div><div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4"><label className="min-w-[240px] flex-1 text-xs text-muted">Search TRX, client, wallet, merchant<input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /></label><label className="text-xs text-muted">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"><option value="">All statuses</option>{[...new Set(all.map((row) => row.status).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></label><button disabled={busy || !selected.size} onClick={() => removeRaw(rows.filter((row) => selected.has(String(row.tx_id))))} className="rounded-lg bg-danger px-4 py-2 text-sm font-bold text-white disabled:opacity-40">🗑 Remove raw from OnTarget ({selected.size})</button><button disabled className="rounded-lg border border-danger/30 px-4 py-2 text-sm font-bold text-danger opacity-50" title="No Maven delete endpoint is configured">Delete from Maven unavailable</button></div><DataTable columns={columns} data={rows} loading={query.isLoading} error={query.error} selectable selectedKeys={selected} getRowKey={(row) => String(row.tx_id)} onToggleRow={(_row, key) => toggle(key)} onToggleAll={toggleAll} onRowClick={openRaw} emptyEmoji="💸" emptyTitle="No Maven payout transactions found" emptySubtitle="The poller must ingest Maven payout records before they appear here." /></div></div><Modal open={!!editing} onClose={() => !busy && setEditing(null)} title={`Edit full raw · ${editing?.tx_id || ''}`} width="max-w-3xl" footer={<><button onClick={() => setEditing(null)} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm text-text">Cancel</button><button onClick={saveRaw} disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-bg">{busy ? 'Saving…' : 'Save raw'}</button></>}><div className="space-y-3"><p className="text-xs text-muted">JSON only. This edits both <code>raw</code> and <code>maven_raw_row</code> in OnTarget.</p><textarea value={rawText} onChange={(event) => setRawText(event.target.value)} spellCheck="false" className="min-h-[420px] w-full rounded-xl border border-border bg-surface p-4 font-mono text-xs text-text" /></div></Modal></div>
}

function Stat({ label, value }) { return <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted">{label}</div><div className="mt-2 text-xl font-black text-gold">{value}</div></div> }
