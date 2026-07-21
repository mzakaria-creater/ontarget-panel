export default function SystemPulse({ live = true, value = 'LIVE', label = 'System health' }) {
  return <div className="system-pulse group" aria-label={`${label}: ${value}`}>
    <div className="system-pulse__scene" aria-hidden="true">
      <div className="system-pulse__ring system-pulse__ring--one" />
      <div className="system-pulse__ring system-pulse__ring--two" />
      <div className={`system-pulse__core ${live ? 'system-pulse__core--live' : ''}`}><span /></div>
    </div>
    <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{label}</div><div className="mt-1 flex items-center gap-2 text-sm font-extrabold text-text"><span className={`h-2 w-2 rounded-full ${live ? 'bg-success shadow-[0_0_12px_var(--color-success)]' : 'bg-warning'}`} />{value}</div></div>
  </div>
}
