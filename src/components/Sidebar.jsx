import { NavLink } from 'react-router-dom'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { fetchRecoveryCandidates } from '../utils/recoveryMatch'
import { useLanguage } from './LanguageContext'
import { useTheme } from './ThemeContext'

const NAV_GROUPS = [
  {
    label: 'المراقبة المباشرة',
    items: [
      { to: '/monitor', label: 'المراقبة', icon: '📊' },
      { to: '/tv', label: 'Monitor TV', icon: '📺' },
      { to: '/tvscreen', label: 'شاشة TV', icon: '🖥️' },
      { to: '/smslive', label: 'الرسائل المباشرة', icon: '📨', badgeKey: 'sms' },
      { to: '/wallet-monitor', label: 'مراقبة المحافظ', icon: '📱' },
      { to: '/health', label: 'صحة النظام', icon: '🩺' },
    ],
  },
  {
    label: 'الموافقات',
    items: [
      { to: '/payin-approval-queue', label: 'موافقات الإيداع', icon: '🧾', badgeKey: 'payin' },
      { to: '/approval-queue', label: 'موافقات السحب', icon: '✅' },
      { to: '/payout-list', label: 'P2P Payout Txs', icon: '📋' },
    ],
  },
  {
    label: 'العمليات',
    items: [
      { to: '/recovery', label: 'استرجاع', icon: '⚡', badgeKey: 'recovery' },
      { to: '/recovery-panel', label: 'استرجاع ومراقبة', icon: '🧭' },
      { to: '/complaints', label: 'مهام الشكاوى', icon: '🧩' },
      { to: '/blacklist', label: 'القائمة السوداء', icon: '🚫' },
      { to: '/telegram', label: 'Telegram Bot', icon: '🤖' },
    ],
  },
  {
    label: 'المحافظ والبنوك',
    items: [
      { to: '/wallets', label: 'المحافظ', icon: '💳' },
      { to: '/wallet-flow', label: 'حركة المحافظ', icon: '💰' },
      { to: '/mavenwallets', label: 'محافظ Maven', icon: '🏦' },
      { to: '/maven-payouts', label: 'Maven Payout TRX + Raw', icon: '💸' },
      { to: '/hub', label: 'Treasury & Wallets', icon: '🏛️' },
      { to: '/wallet-sms-report', label: 'تقرير SMS للمحافظ', icon: '📊' },
      { to: '/wallet-report', label: 'تقرير المحافظ', icon: '👛' },
    ],
  },
  {
    label: 'التقارير والتحليلات',
    items: [
      { to: '/report', label: 'التقرير الشامل', icon: '📑' },
      { to: '/analytics', label: 'التحليلات', icon: '📊' },
      { to: '/analytics-overview', label: 'تحليلات الأداء', icon: '📈' },
      { to: '/gateway', label: 'Gateway Overview', icon: '🔌' },
      { to: '/payouts', label: 'Payout Transactions', icon: '💸', badgeKey: 'payout' },
      { to: '/settlement', label: 'Settlement & P&L', icon: '💼' },
    ],
  },
  {
    label: 'الإعدادات',
    items: [
      { to: '/settings', label: 'الإعدادات', icon: '⚙️' },
      { to: '/users', label: 'المستخدمون والصلاحيات', icon: '👥' },
    ],
  },
]

export default function Sidebar() {
  const { language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { data: candidates } = useRealtimeTable({
    key: ['recovery-badge'],
    queryFn: async () => ({ data: await fetchRecoveryCandidates(2) }),
    intervalMs: 60000,
  })

  const recoveryCount = candidates?.length || 0
  const { data: smsUpdates } = useRealtimeTable({
    key: ['sidebar-sms-updates'],
    queryFn: async (sb) => sb.from('inbound_sms').select('id').gte('received_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(99),
    intervalMs: 5000,
  })
  const smsCount = smsUpdates?.length || 0
  const { data: payoutRequests } = useRealtimeTable({
    key: ['sidebar-payout-requests'],
    queryFn: async (sb) => sb.from('transactions').select('id').eq('trx_type', 'withdrawal').eq('status', 'pending').limit(99),
    intervalMs: 10000,
  })
  const payoutCount = payoutRequests?.length || 0

  return (
    <aside className="group hidden h-full w-[76px] shrink-0 flex-col overflow-hidden border-l border-border bg-surface transition-[width] duration-300 ease-out hover:w-64 md:flex">
      <div className="flex min-w-[76px] items-center justify-between border-b border-border px-4 py-5 transition-[padding] duration-300 group-hover:px-5">
        <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-gold" />
        <span className="whitespace-nowrap text-lg font-extrabold text-text opacity-0 transition-opacity duration-200 group-hover:opacity-100">OnTarget</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"><button onClick={toggleTheme} className="rounded-lg border border-border px-2 py-1 text-sm text-muted hover:border-gold hover:text-gold" title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>{theme === 'dark' ? '☀️' : '🌙'}</button><button onClick={toggleLanguage} className="rounded-lg border border-border px-2 py-1 text-xs font-bold text-muted hover:border-gold hover:text-gold">{language === 'ar' ? 'EN' : 'عربي'}</button></div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-5 transition-[padding] duration-300 group-hover:px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="h-0 overflow-hidden px-2 pb-0 text-xs font-semibold text-muted opacity-0 transition-all duration-200 group-hover:h-6 group-hover:pb-2 group-hover:opacity-100">{group.label}</div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-lg px-3 py-3 text-sm font-medium transition-colors group-hover:py-2.5 ${
                      isActive ? 'bg-gold/15 text-gold' : 'text-text/80 hover:bg-card hover:text-text'
                    }`
                  }
                >
                  <span className="flex min-w-0 items-center justify-center gap-2 group-hover:justify-start">
                    <span className="shrink-0 text-lg leading-none">{item.icon}</span>
                    <span className="hidden truncate opacity-0 transition-opacity duration-200 group-hover:inline group-hover:opacity-100">{item.label}</span>
                  </span>
                  {item.badgeKey === 'recovery' && recoveryCount > 0 && (
                    <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
                      {recoveryCount}
                    </span>
                  )}
                  {item.to === '/smslive' && smsCount > 0 && <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">{smsCount > 99 ? '99+' : smsCount}</span>}
                  {item.badgeKey === 'payout' && payoutCount > 0 && <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">{payoutCount > 99 ? '99+' : payoutCount}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex min-w-[76px] items-center justify-center gap-2 border-t border-border px-4 py-4 text-xs text-muted transition-[padding] duration-300 group-hover:justify-start group-hover:px-5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <span className="hidden whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:inline group-hover:opacity-100">متصل الآن</span>
      </div>
    </aside>
  )
}
