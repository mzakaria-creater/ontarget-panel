export function smsReferenceOf(row = {}) {
  return row.sms_reference || row.sms_ref_id || row.trx_reference || row.trx_id || row.reference_id || row.reference || ''
}

export function dedupeSms(rows = []) {
  const sorted = [...rows].sort((a, b) => new Date(b.received_at || b.created_at || 0) - new Date(a.received_at || a.created_at || 0))
  const seen = new Set()
  return sorted.filter((row) => {
    const reference = String(smsReferenceOf(row) || '').trim().toLowerCase()
    if (!reference) return true
    if (seen.has(reference)) return false
    seen.add(reference)
    return true
  })
}
