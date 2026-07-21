export function formatNumber(value) {
  const n = Number(value ?? 0)
  return n.toLocaleString('en-US')
}

export function formatMoney(value) {
  const n = Number(value ?? 0)
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatAbsoluteDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCairoDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatUtcDate(value) {
  if (!value) return '—'
  return new Date(value).toISOString().replace('T', ' ').replace('Z', ' UTC')
}

export function formatRelativeTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  const now = new Date()
  const diffMs = now - date
  const diffSec = Math.round(diffMs / 1000)

  if (diffSec < 5) return 'الآن'
  if (diffSec < 60) return `منذ ${formatNumber(diffSec)} ثانية`

  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `منذ ${formatNumber(diffMin)} دقيقة`

  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `منذ ${formatNumber(diffHour)} ساعة`

  const diffDay = Math.round(diffHour / 24)
  return `منذ ${formatNumber(diffDay)} يوم`
}

export function diffMinutes(dateA, dateB) {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.round(Math.abs(a - b) / 60000)
}
