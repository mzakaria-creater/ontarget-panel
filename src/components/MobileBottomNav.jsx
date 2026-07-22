import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useLanguage } from './LanguageContext'

const DIRECT = [
  { to: '/monitor', icon: '📊', ar: 'المراقبة', en: 'Monitor' },
  { to: '/smslive', icon: '📨', ar: 'SMS', en: 'SMS' },
  { to: '/complaints', icon: '🧩', ar: 'الشكاوى', en: 'Complaints' },
  { to: '/wallets', icon: '💳', ar: 'المحافظ', en: 'Wallets' },
  { to: '/settings', icon: '⚙️', ar: 'الإعدادات', en: 'Settings' },
  { to: '/report', icon: '🗄️', ar: 'TRX', en: 'TRX' },
]

const ALL_PAGES = [...DIRECT, { to: '/tv', icon: '📺', ar: 'شاشة المراقبة', en: 'Monitor TV' }, { to: '/wallet-monitor', icon: '📱', ar: 'مراقبة المحافظ', en: 'Wallet Monitor' }, { to: '/mavenwallets', icon: '🏦', ar: 'محافظ Maven', en: 'Maven Wallets' }, { to: '/health', icon: '🩺', ar: 'صحة النظام', en: 'System Health' }, { to: '/wallet-sms-report', icon: '📊', ar: 'تقرير SMS للمحافظ', en: 'Wallet SMS Report' }, { to: '/wallet-flow', icon: '💰', ar: 'حركة المحافظ', en: 'Wallet Flow' }, { to: '/recovery-panel', icon: '🧭', ar: 'استرجاع ومراقبة', en: 'Recovery Panel' }, { to: '/telegram', icon: '🤖', ar: 'Telegram', en: 'Telegram' }, { to: '/recovery', icon: '⚡', ar: 'الاسترجاع', en: 'Recovery' }, { to: '/settlement', icon: '💼', ar: 'التسويات', en: 'Settlement' }, { to: '/blacklist', icon: '🚫', ar: 'القائمة السوداء', en: 'Blacklist' }, { to: '/report', icon: '📑', ar: 'التقرير', en: 'Report' }, { to: '/analytics', icon: '📈', ar: 'التحليلات', en: 'Analytics' }, { to: '/users', icon: '👥', ar: 'المستخدمون', en: 'Users' }]

export default function MobileBottomNav() {
  const { language } = useLanguage()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  return <>
    {open && <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[3px] md:hidden" onClick={() => setOpen(false)}><div className="mobile-app-sheet" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-extrabold text-text">{language === 'ar' ? 'كل تطبيقات OnTarget' : 'All OnTarget apps'}</h2><p className="text-xs text-muted">{language === 'ar' ? 'اختر صفحة للانتقال إليها' : 'Choose a page to open'}</p></div><button className="rounded-xl border border-border px-3 py-2 text-sm text-muted" onClick={() => setOpen(false)}>✕</button></div><div className="grid grid-cols-3 gap-3">{ALL_PAGES.map((item) => <button key={item.to} onClick={() => { navigate(item.to); setOpen(false) }} className={`mobile-app-tile ${location.pathname === item.to ? 'mobile-app-tile-active' : ''}`}><span>{item.icon}</span><b>{language === 'ar' ? item.ar : item.en}</b></button>)}</div></div></div>}
    <nav className="mobile-bottom-glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
      <MobileItem item={DIRECT[0]} language={language} />
      <MobileItem item={DIRECT[1]} language={language} />
      <MobileItem item={DIRECT[2]} language={language} />
      <button onClick={() => setOpen(true)} className="mobile-center-app"><span>▦</span><b>{language === 'ar' ? 'التطبيقات' : 'Apps'}</b></button>
      <MobileItem item={DIRECT[3]} language={language} />
      <MobileItem item={DIRECT[4]} language={language} />
      <MobileItem item={DIRECT[5]} language={language} />
    </nav>
  </>
}

function MobileItem({ item, language }) {
  return <NavLink to={item.to} className={({ isActive }) => `mobile-glass-item ${isActive ? 'mobile-glass-item-active' : ''}`}><span>{item.icon}</span><b>{language === 'ar' ? item.ar : item.en}</b></NavLink>
}
