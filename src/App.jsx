import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
const Monitor = lazy(() => import('./pages/Monitor'))
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
const AutomationTV = lazy(() => import('./pages/AutomationTV'))
const TvScreen = lazy(() => import('./pages/TvScreen'))
const MavenWallets = lazy(() => import('./pages/MavenWallets'))
const MavenPayouts = lazy(() => import('./pages/MavenPayouts'))
const WithdrawalSmsQueue = lazy(() => import('./pages/WithdrawalSmsQueue'))
const AllTransactionsRaw = lazy(() => import('./pages/AllTransactionsRaw'))
const Health = lazy(() => import('./pages/Health'))
const HealthV2 = lazy(() => import('./pages/HealthV2'))
const WalletSmsReport = lazy(() => import('./pages/WalletSmsReport'))
const GatewayOverview = lazy(() => import('./pages/GatewayOverview'))
const Payouts = lazy(() => import('./pages/Payouts'))
const TreasuryHub = lazy(() => import('./pages/TreasuryHub'))
const HubFinance = lazy(() => import('./pages/HubFinance'))
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue'))
const PayinApprovalQueue = lazy(() => import('./pages/PayinApprovalQueue'))
const PayoutTransactionsV2 = lazy(() => import('./pages/PayoutTransactionsV2'))
import WalletFlow from './pages/WalletFlow'
const RecoveryPanel = lazy(() => import('./pages/RecoveryPanel'))
const AbuseFlags = lazy(() => import('./pages/AbuseFlags'))
const Crm = lazy(() => import('./pages/Crm'))
const WalletMonitor = lazy(() => import('./pages/WalletMonitor'))
import { LanguageProvider } from './components/LanguageContext'
import MobileBottomNav from './components/MobileBottomNav'
import { ThemeProvider } from './components/ThemeContext'
import MacbookDock from './components/MacbookDock'

function withBoundary(Page) {
  return <ErrorBoundary><Suspense fallback={<div className="flex h-full items-center justify-center bg-bg text-sm text-muted">جاري تحميل الصفحة...</div>}><Page /></Suspense></ErrorBoundary>
}

export default function App() {
  return (
    <ThemeProvider><LanguageProvider><ToastProvider>
      <BrowserRouter>
        <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
          <Sidebar />
          <main className="desktop-canvas min-w-0 flex-1 overflow-hidden pb-16 md:pb-0">
            <Routes>
              <Route path="/" element={<Navigate to="/monitor" replace />} />
              <Route path="/dashboard" element={<Navigate to="/monitor" replace />} />
              <Route path="/transactions" element={<Navigate to="/monitor" replace />} />
              <Route path="/monitor" element={withBoundary(Monitor)} />
              <Route path="/tv" element={withBoundary(AutomationTV)} />
              <Route path="/tvscreen" element={withBoundary(TvScreen)} />
              <Route path="/wallet-monitor" element={withBoundary(WalletMonitor)} />
              <Route path="/mavenwallets" element={withBoundary(MavenWallets)} />
              <Route path="/maven-payouts" element={withBoundary(MavenPayouts)} />
              <Route path="/withdrawal-sms" element={withBoundary(WithdrawalSmsQueue)} />
              <Route path="/transactions-raw" element={withBoundary(AllTransactionsRaw)} />
              <Route path="/alldata" element={withBoundary(AllTransactionsRaw)} />
              <Route path="/health" element={withBoundary(HealthV2)} />
              <Route path="/wallet-sms-report" element={withBoundary(WalletSmsReport)} />
              <Route path="/gateway" element={withBoundary(GatewayOverview)} />
              <Route path="/payouts" element={withBoundary(Payouts)} />
              <Route path="/hub" element={withBoundary(TreasuryHub)} />
              <Route path="/hub/finance" element={withBoundary(HubFinance)} />
              <Route path="/approval-queue" element={withBoundary(ApprovalQueue)} />
              <Route path="/payin-approval-queue" element={withBoundary(PayinApprovalQueue)} />
              <Route path="/payout-list" element={withBoundary(PayoutTransactionsV2)} />
              <Route path="/smslive" element={withBoundary(SmsLive)} />
              <Route path="/blacklist" element={withBoundary(Blacklist)} />
              <Route path="/abuseflags" element={withBoundary(AbuseFlags)} />
              <Route path="/crm" element={withBoundary(Crm)} />
              <Route path="/complaints" element={withBoundary(Complaints)} />
              <Route path="/telegram" element={withBoundary(TelegramBot)} />
              <Route path="/users" element={withBoundary(UsersAdmin)} />
              <Route path="/settlement" element={withBoundary(Settlement)} />
              <Route path="/recovery" element={withBoundary(Recovery)} />
              <Route path="/recovery-panel" element={withBoundary(RecoveryPanel)} />
              <Route path="/wallets" element={withBoundary(Wallets)} />
              <Route path="/wallet-flow" element={withBoundary(WalletFlow)} />
              <Route path="/settings" element={withBoundary(Settings)} />
              <Route path="/report" element={withBoundary(Report)} />
              <Route path="/analytics" element={withBoundary(AnalyticsDashboard)} />
              <Route path="/analytics-overview" element={withBoundary(AnalyticsPage)} />
              <Route path="/wallet-report" element={withBoundary(WalletReport)} />
              <Route path="*" element={<Navigate to="/monitor" replace />} />
            </Routes>
          </main>
          <MacbookDock />
          <MobileBottomNav />
        </div>
      </BrowserRouter>
    </ToastProvider></LanguageProvider></ThemeProvider>
  )
}
