const STATUS_STYLES = {
  PAID: 'bg-success/15 text-success border-success/30',
  DECLINED: 'bg-danger/15 text-danger border-danger/30',
  PENDING: 'bg-warning/15 text-warning border-warning/30',
}

const STATUS_LABELS = {
  PAID: 'مدفوعة',
  DECLINED: 'مرفوضة',
  PENDING: 'قيد الانتظار',
}

export default function Badge({ status, children }) {
  if (children) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-text">
        {children}
      </span>
    )
  }

  const style = STATUS_STYLES[status] || 'bg-muted/15 text-muted border-muted/30'
  const label = STATUS_LABELS[status] || status

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {label}
    </span>
  )
}
