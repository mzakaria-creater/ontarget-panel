const TONE_STYLES = {
  default: 'text-gold',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
}

export default function StatCard({ label, value, tone = 'default', icon, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-extrabold ${TONE_STYLES[tone] || TONE_STYLES.default}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  )
}
