import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import Monitor from './pages/Monitor'
import SmsLive from './pages/SmsLive'
import Recovery from './pages/Recovery'
import Wallets from './pages/Wallets'
import Settings from './pages/Settings'
import Report from './pages/Report'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import AnalyticsPage from './pages/AnalyticsPage'
import WalletReport from './pages/WalletReport'
import Blacklist from './pages/Blacklist'
import Complaints from './pages/Complaints'
import TelegramBot from './pages/TelegramBot'
import UsersAdmin from './pages/UsersAdmin'
import Settlement from './pages/Settlement'
import { LanguageProvider } from './components/LanguageContext'
import MobileBottomNav from './components/MobileBottomNav'
import { ThemeProvider } from './components/ThemeContext'

function withBoundary(Page) {
  return <ErrorBoundary><Page /></ErrorBoundary>
}

export default function App() {
  return (
    <ThemeProvider><LanguageProvider><ToastProvider>
      <BrowserRouter>
        <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-hidden pb-16 md:pb-0">
            <Routes>
              <Route path="/" element={<Navigate to="/monitor" replace />} />
              <Route path="/monitor" element={withBoundary(Monitor)} />
              <Route path="/smslive" element={withBoundary(SmsLive)} />
              <Route path="/blacklist" element={withBoundary(Blacklist)} />
              <Route path="/complaints" element={withBoundary(Complaints)} />
              <Route path="/telegram" element={withBoundary(TelegramBot)} />
              <Route path="/users" element={withBoundary(UsersAdmin)} />
              <Route path="/settlement" element={withBoundary(Settlement)} />
              <Route path="/recovery" element={withBoundary(Recovery)} />
              <Route path="/wallets" element={withBoundary(Wallets)} />
              <Route path="/settings" element={withBoundary(Settings)} />
              <Route path="/report" element={withBoundary(Report)} />
              <Route path="/analytics" element={withBoundary(AnalyticsDashboard)} />
              <Route path="/analytics-overview" element={withBoundary(AnalyticsPage)} />
              <Route path="/wallet-report" element={withBoundary(WalletReport)} />
              <Route path="*" element={<Navigate to="/monitor" replace />} />
            </Routes>
          </main>
          <MobileBottomNav />
        </div>
      </BrowserRouter>
    </ToastProvider></LanguageProvider></ThemeProvider>
  )
}
