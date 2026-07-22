export function smsAmountOf(row = {}) {
  const direct = Number(row.amount)
  if (Number.isFinite(direct) && direct > 0) return direct
  const raw = typeof row.raw_sms === 'object' ? JSON.stringify(row.raw_sms) : String(row.raw_sms || row.message || row.sms_first_line || '')
  const patterns = [/(?:amount|المبلغ)\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i, /(?:مبلغ|بقيمة)\s+([\d,]+(?:\.\d+)?)\s*(?:جنيه|جنيهًا|ج|EGP|LE)?/i, /([\d,]+(?:\.\d+)?)\s*(?:جنيه|جنيهًا|EGP|LE)\b/i]
  for (const pattern of patterns) { const match = raw.match(pattern); const value = Number(String(match?.[1] || '').replace(/,/g, '')); if (Number.isFinite(value) && value > 0) return value }
  return 0
}
