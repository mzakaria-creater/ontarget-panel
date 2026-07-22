import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from './LanguageContext'
import { useTheme } from './ThemeContext'

export default function Topbar({ title, subtitle, onRefresh, isFetching, actions, notifications = [], smsNotifications = [] }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [smsOpen, setSmsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const navigate = useNavigate()
  const { language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const [macbook, setMacbook] = useState(() => localStorage.getItem('ot-macbook-mode') === '1')
  useEffect(() => { document.body.classList.toggle('macbook-mode', macbook) }, [macbook])
  function toggleMacbook() { const next = !macbook; setMacbook(next); localStorage.setItem('ot-macbook-mode', next ? '1' : '0'); document.body.classList.toggle('macbook-mode', next); window.dispatchEvent(new CustomEvent('ot-macbook-mode', { detail: next })) }
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    if (!onRefresh) return
    const onKeyDown = (e) => {
      const target = e.target
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (isTyping) return
      if (e.key === 'r' || e.key === 'R') {
        onRefresh()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onRefresh])

  return (
    <div className="app-topbar flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface/60 px-3 py-2 md:px-6 md:py-4">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-extrabold text-text md:text-lg">{title}</h1>
        {subtitle && <p className="hidden truncate text-sm text-muted sm:block">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {actions}
        <div className="hidden text-right leading-tight lg:block"><div className="text-xs font-semibold text-text">{now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' })}</div><div className="text-[11px] text-muted">Cairo {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Cairo' })}</div></div>
        <button onClick={toggleLanguage} className="h-9 min-h-9 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-bold text-muted hover:border-gold/50 hover:text-gold">{language === 'ar' ? 'EN' : 'عربي'}</button>
        <button onClick={toggleTheme} className="h-9 min-h-9 rounded-lg border border-border bg-card p-1.5 text-base leading-none text-muted hover:border-gold/50 hover:text-gold" title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>{theme === 'dark' ? '☀️' : '🌙'}</button>
        <button onClick={toggleMacbook} className={`hidden h-9 min-h-9 rounded-lg border bg-card p-1.5 text-base leading-none hover:border-gold/50 hover:text-gold lg:block ${macbook ? 'border-gold text-gold' : 'border-border text-muted'}`} title="Toggle MacBook desktop view" aria-label="Toggle MacBook desktop view">💻</button>
        <div className="relative">
          <button onClick={() => setSmsOpen((open) => !open)} className="relative h-9 min-h-9 rounded-lg border border-border bg-card p-1.5 text-muted hover:border-gold/50 hover:text-gold" title="SMS notifications"><span className="text-base leading-none">📨</span>{smsNotifications.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{smsNotifications.length > 9 ? '9+' : smsNotifications.length}</span>}</button>
          {smsOpen && <div className="absolute left-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border px-4 py-3"><span className="font-bold text-text">SMS Live</span><span className="text-xs text-muted">{smsNotifications.length} جديدة</span></div><div className="max-h-80 overflow-y-auto">{smsNotifications.length ? smsNotifications.map((item, index) => <button key={item.id || index} onClick={() => { window.location.href = '/smslive' }} className="block w-full border-b border-border px-4 py-3 text-right hover:bg-surface"><div className="text-sm font-semibold text-text">{item.title}</div><div className="mt-1 text-xs text-muted">{item.body}</div></button>) : <div className="px-4 py-8 text-center text-sm text-muted">لا توجد رسائل جديدة</div>}</div></div>}
        </div>
        <div className="relative"><button onClick={() => setProfileOpen((open) => !open)} className="flex h-9 min-h-9 items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1 hover:border-gold/50"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">OT</span><span className="hidden text-xs font-semibold text-text sm:block">Operator</span><span className="text-xs text-muted">⌄</span></button>{profileOpen && <div className="absolute left-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"><div className="border-b border-border px-4 py-3"><div className="font-bold text-text">Operator</div><div className="text-xs text-muted">Administrator</div></div><button onClick={() => navigate('/users')} className="block w-full px-4 py-3 text-left text-sm text-text hover:bg-surface">Profile & users</button><button onClick={() => navigate('/settings')} className="block w-full px-4 py-3 text-left text-sm text-text hover:bg-surface">Profile settings</button><button onClick={() => { localStorage.removeItem('ontarget-language'); window.location.href = '/' }} className="block w-full border-t border-border px-4 py-3 text-left text-sm text-danger hover:bg-danger/10">Log out</button></div>}</div>
        <div className="relative">
          <button onClick={() => setNotificationsOpen((open) => !open)} className="relative h-9 min-h-9 rounded-lg border border-border bg-card p-1.5 text-muted hover:border-gold/50 hover:text-gold" title="الإشعارات">
            <span className="text-base leading-none">🔔</span>
            {notifications.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{notifications.length > 9 ? '9+' : notifications.length}</span>}
          </button>
          {notificationsOpen && <div className="absolute left-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3"><span className="font-bold text-text">الإشعارات</span><span className="text-xs text-muted">{notifications.length} جديدة</span></div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length ? notifications.map((item, index) => <div key={item.id || index} className="border-b border-border px-4 py-3 last:border-0 hover:bg-surface"><div className="text-sm font-semibold text-text">{item.title}</div><div className="mt-1 text-xs text-muted">{item.body}</div></div>) : <div className="px-4 py-8 text-center text-sm text-muted">لا توجد إشعارات جديدة</div>}
            </div>
          </div>}
        </div>
        {onRefresh && <button onClick={onRefresh} className="flex h-9 min-h-9 items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-sm font-medium text-text hover:border-gold/50 hover:text-gold" title="تحديث (R)"><span className={isFetching ? 'animate-spin' : ''}>🔄</span><span className="hidden sm:inline">تحديث</span></button>}
      </div>
    </div>
  )
}
