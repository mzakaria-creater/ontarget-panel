import { supabase } from '../lib/supabase'
import { diffMinutes } from './format'

const MS_PER_HOUR = 3600 * 1000

/**
 * Matches DECLINED transactions against unconsumed deposit SMS by sender_number + amount,
 * within `windowHours` of the transaction's created_utc. One SMS is matched to at most one tx.
 */
export function computeRecoveryCandidates(transactions, smsList, windowHours) {
  const availableSms = [...smsList]
  const candidates = []

  for (const tx of transactions) {
    const txTime = new Date(tx.created_utc).getTime()
    let bestIndex = -1
    let bestDiff = Infinity

    availableSms.forEach((sms, idx) => {
      if (sms.sender_number !== tx.sender_number) return
      if (Number(sms.amount) !== Number(tx.amount)) return
      const smsTime = new Date(sms.received_at).getTime()
      const diffMs = Math.abs(smsTime - txTime)
      if (diffMs > windowHours * MS_PER_HOUR) return
      if (diffMs < bestDiff) {
        bestDiff = diffMs
        bestIndex = idx
      }
    })

    if (bestIndex !== -1) {
      const sms = availableSms[bestIndex]
      availableSms.splice(bestIndex, 1)
      candidates.push({
        tx,
        sms,
        diffMinutes: diffMinutes(tx.created_utc, sms.received_at),
      })
    }
  }

  return candidates
}

export async function fetchRecoveryCandidates(windowHours) {
  const since = new Date(Date.now() - windowHours * MS_PER_HOUR).toISOString()

  const [{ data: transactions, error: txError }, { data: smsList, error: smsError }] = await Promise.all([
    supabase
      .from('maven_transactions')
      .select('*')
      .eq('status', 'DECLINED')
      .gte('created_utc', since)
      .order('created_utc', { ascending: true }),
    supabase
      .from('inbound_sms')
      .select('*')
      .is('consumed_by_tx_id', null)
      .eq('sms_category', 'deposit')
      .gte('received_at', since)
      .order('received_at', { ascending: true }),
  ])

  if (txError) throw txError
  if (smsError) throw smsError

  return computeRecoveryCandidates(transactions || [], smsList || [], windowHours)
}
