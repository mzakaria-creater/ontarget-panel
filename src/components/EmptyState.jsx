export default function EmptyState({ emoji = '📭', title = 'لا توجد بيانات', subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="text-5xl">{emoji}</div>
      <div className="text-base font-semibold text-text">{title}</div>
      {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
    </div>
  )
}
