import { formatAbsoluteDate, formatMoney } from '../utils/format'

const txIdOf = (row) => row?.tx_id ?? row?.transaction_id ?? row?.id

function smsMatchesTx(sms, txId) {
  const target = String(txId ?? '')
  return [sms?.consumed_by_tx_id, sms?.matched_transaction_id, sms?.maven_transaction_id, sms?.trx_id, sms?.trx_reference]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .some((value) => String(value) === target)
}

function statusClass(status) {
  const value = String(status || '').toUpperCase()
  if (['PAID', 'APPROVED', 'COMPLETED', 'SUCCEEDED'].includes(value)) return 'bg-success/15 text-success'
  if (['DECLINED', 'FAILED', 'EXPIRED'].includes(value)) return 'bg-danger/15 text-danger'
  return 'bg-warning/15 text-warning'
}

export default function TransactionSmsTable({ transactions = [], smsRows = [], loading = false, error = null, title = 'Transactions + raw SMS', emptyTitle = 'No transactions found', onTransactionClick }) {
  const smsByTx = new Map()
  for (const sms of smsRows) {
    const txId = [sms.consumed_by_tx_id, sms.matched_transaction_id, sms.maven_transaction_id, sms.trx_id, sms.trx_reference]
      .find((value) => value !== null && value !== undefined && value !== '')
    if (txId !== undefined) {
      const key = String(txId)
      smsByTx.set(key, [...(smsByTx.get(key) || []), sms])
    }
  }

  if (loading) return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">Loading transactions and SMS…</div>
  if (error) return <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger">Unable to load transactions: {String(error.message || error)}</div>
  if (!transactions.length) return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted">{emptyTitle}</div>

  const smsCount = transactions.reduce((count, tx) => count + (smsByTx.get(String(txIdOf(tx))) || []).length, 0)
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-5">
        <div className="font-bold">{title}</div>
        <div className="text-xs text-muted">{transactions.length} transactions · {smsCount} SMS rows</div>
      </div>
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="bg-surface text-xs uppercase text-muted">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">TRX ID</th>
            <th className="px-4 py-3">SMS ID</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Method / Sender</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Raw SMS</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, index) => {
            const txId = txIdOf(tx)
            const linkedSms = smsByTx.get(String(txId)) || []
            return (
              <TransactionGroup key={String(txId ?? index)} tx={tx} txId={txId} linkedSms={linkedSms} onTransactionClick={onTransactionClick} />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TransactionGroup({ tx, txId, linkedSms, onTransactionClick }) {
  return <>
    <tr onClick={() => onTransactionClick?.(tx)} className={`border-t border-border bg-card hover:bg-surface ${onTransactionClick ? 'cursor-pointer' : ''}`}>
      <td className="px-4 py-3 font-semibold text-gold">TRX</td>
      <td className="px-4 py-3 font-mono font-bold text-gold">{txId || '—'}</td>
      <td className="px-4 py-3 text-muted">{linkedSms.length ? `${linkedSms.length} linked` : '—'}</td>
      <td className="px-4 py-3 text-muted">{formatAbsoluteDate(tx.created_utc || tx.tx_time || tx.created_at || tx.date)}</td>
      <td className="px-4 py-3">{tx.payment_method || tx.method || tx.sender_name || '—'}</td>
      <td className="px-4 py-3 font-bold">{formatMoney(tx.amount)}</td>
      <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(tx.status)}`}>{tx.status || '—'}</span></td>
      <td className="px-4 py-3 text-muted">Raw Maven transaction</td>
    </tr>
    {linkedSms.map((sms, index) => <tr key={`${String(txId)}-sms-${sms.id ?? index}`} className="border-t border-border/60 bg-success/5 text-xs">
      <td className="px-4 py-3 pl-8 font-semibold text-success">↳ SMS</td>
      <td className="px-4 py-3 font-mono text-gold">{txId || '—'}</td>
      <td className="px-4 py-3 font-mono font-bold text-success">{sms.id || '—'}</td>
      <td className="px-4 py-3 text-muted">{formatAbsoluteDate(sms.received_at || sms.created_at)}</td>
      <td className="px-4 py-3">{sms.sender_name || sms.sender_number || sms.provider || '—'}</td>
      <td className="px-4 py-3 font-bold text-success">{formatMoney(sms.amount)}</td>
      <td className="px-4 py-3 text-success">{sms.match_status || (sms.matched ? 'MATCHED' : 'LINKED')}</td>
      <td className="max-w-[420px] whitespace-pre-wrap break-words px-4 py-3 text-text">{sms.raw_sms || sms.message || sms.body || '—'}</td>
    </tr>)}
  </>
}

export { smsMatchesTx }
