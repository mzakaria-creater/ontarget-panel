import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatNumber } from '../utils/format'
import { useToast } from '../components/Toast'
import Topbar from '../components/Topbar'
import DataTable from '../components/DataTable'
import EditableCell from '../components/EditableCell'
import Switch from '../components/Switch'
import Modal from '../components/Modal'

const PROVIDER_STYLES = {
  VodafoneCash: 'text-danger',
  'Orange Money': 'text-warning',
  'Mobile Wallet': 'text-blue-400',
}

const EMPTY_ACCOUNT = {
  wallet: '',
  provider: 'VodafoneCash',
  merchant: '',
  wallet_name: '',
  sim_slot: '',
  device_code: '',
  active: true,
  auto_approve_enabled: false,
  daily_limit: 0,
}

function ProviderLabel({ provider }) {
  return <span className={`font-semibold ${PROVIDER_STYLES[provider] || 'text-text'}`}>{provider}</span>
}

export default function Wallets() {
  const { showToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [newAccount, setNewAccount] = useState(EMPTY_ACCOUNT)
  const [saving, setSaving] = useState(false)

  const accounts = useRealtimeTable({
    key: ['wallet-accounts'],
    queryFn: async (sb) => sb.from('wallet_accounts').select('*').order('wallet', { ascending: true }),
    intervalMs: 30000,
  })

  const deviceMap = useRealtimeTable({
    key: ['wallet-device-map'],
    queryFn: async (sb) => sb.from('wallet_device_map').select('*').order('to_account_number', { ascending: true }),
    intervalMs: 30000,
  })

  const walletRegistry = useRealtimeTable({
    key: ['wallet-registry'],
    queryFn: async (sb) => sb.from('wallet_registry').select('*').order('wallet_number', { ascending: true }),
    intervalMs: 30000,
  })

  const bankRegistry = useRealtimeTable({
    key: ['merchant-bank-registry'],
    queryFn: async (sb) => sb.from('merchant_bank_registry').select('*').order('created_at', { ascending: false }),
    intervalMs: 30000,
  })

  async function patchAccount(wallet, patch, label) {
    const { error } = await supabase.from('wallet_accounts').update(patch).eq('wallet', wallet)
    if (error) {
      showToast(`فشل تحديث ${label}: ${error.message}`, 'error')
    } else {
      showToast(`تم تحديث ${label} بنجاح`, 'success')
      accounts.refresh()
    }
  }

  async function patchDeviceMap(toAccountNumber, patch, label) {
    const { error } = await supabase.from('wallet_device_map').update(patch).eq('to_account_number', toAccountNumber)
    if (error) {
      showToast(`فشل تحديث ${label}: ${error.message}`, 'error')
    } else {
      showToast(`تم تحديث ${label} بنجاح`, 'success')
      deviceMap.refresh()
    }
  }

  async function submitNewAccount() {
    if (!newAccount.wallet) {
      showToast('رقم المحفظة مطلوب', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('wallet_accounts').insert(newAccount)
    setSaving(false)
    if (error) {
      showToast(`فشل إضافة المحفظة: ${error.message}`, 'error')
      return
    }
    showToast('تمت إضافة المحفظة بنجاح', 'success')
    setAddOpen(false)
    setNewAccount(EMPTY_ACCOUNT)
    accounts.refresh()
  }

  const accountColumns = [
    { key: 'wallet', label: 'المحفظة' },
    { key: 'provider', label: 'المزود', render: (r) => <ProviderLabel provider={r.provider} /> },
    { key: 'merchant', label: 'التاجر' },
    {
      key: 'wallet_name',
      label: 'اسم المحفظة',
      render: (r) => <EditableCell value={r.wallet_name} onSave={(v) => patchAccount(r.wallet, { wallet_name: v }, 'اسم المحفظة')} />,
    },
    { key: 'sim_slot', label: 'الشريحة' },
    { key: 'device_code', label: 'كود الجهاز' },
    {
      key: 'active',
      label: 'مفعّلة',
      render: (r) => <Switch checked={!!r.active} onChange={(v) => patchAccount(r.wallet, { active: v }, 'التفعيل')} />,
    },
    {
      key: 'auto_approve_enabled',
      label: 'موافقة تلقائية',
      render: (r) => (
        <Switch
          checked={!!r.auto_approve_enabled}
          onChange={(v) => patchAccount(r.wallet, { auto_approve_enabled: v }, 'الموافقة التلقائية')}
        />
      ),
    },
    {
      key: 'daily_limit',
      label: 'الحد اليومي',
      render: (r) => (
        <EditableCell
          type="number"
          value={r.daily_limit}
          onSave={(v) => patchAccount(r.wallet, { daily_limit: v }, 'الحد اليومي')}
        />
      ),
    },
    { key: 'daily_used', label: 'المستخدم اليوم', render: (r) => formatNumber(r.daily_used) },
  ]

  const deviceMapColumns = [
    { key: 'to_account_number', label: 'رقم الحساب' },
    { key: 'device', label: 'الجهاز' },
    { key: 'provider', label: 'المزود', render: (r) => <ProviderLabel provider={r.provider} /> },
    { key: 'sim_slot', label: 'الشريحة' },
    { key: 'merchant', label: 'التاجر' },
    { key: 'confidence', label: 'مستوى الثقة', render: (r) => formatNumber(r.confidence) },
    {
      key: 'daily_limit',
      label: 'الحد اليومي',
      render: (r) => (
        <EditableCell
          type="number"
          value={r.daily_limit}
          onSave={(v) => patchDeviceMap(r.to_account_number, { daily_limit: v }, 'الحد اليومي')}
        />
      ),
    },
  ]

  const registryColumns = [
    { key: 'wallet_number', label: 'رقم المحفظة' },
    { key: 'wallet_name', label: 'اسم المحفظة' },
    { key: 'provider', label: 'المزود', render: (r) => <ProviderLabel provider={r.provider} /> },
    { key: 'device', label: 'الجهاز' },
    { key: 'status', label: 'الحالة' },
    { key: 'daily_limit', label: 'الحد اليومي', render: (r) => formatNumber(r.daily_limit) },
    { key: 'monthly_limit', label: 'الحد الشهري', render: (r) => formatNumber(r.monthly_limit) },
    { key: 'enabled', label: 'مفعّلة', render: (r) => r.enabled ? <span className="text-success">✓ نعم</span> : <span className="text-danger">✕ لا</span> },
  ]

  const bankColumns = [
    { key: 'bank_id', label: 'معرّف البنك' },
    { key: 'merchant_name', label: 'التاجر' },
    { key: 'payment_type', label: 'نوع الدفع' },
    { key: 'wallet_number', label: 'الحساب / المحفظة' },
    { key: 'source', label: 'المصدر' },
    { key: 'created_at', label: 'تاريخ الإضافة', render: (r) => r.created_at ? new Date(r.created_at).toLocaleString('en-GB') : '—' },
  ]

  return (
    <div className="flex h-full flex-col">
      <Topbar title="المحافظ" subtitle="إدارة حسابات المحافظ وربطها بالأجهزة" onRefresh={accounts.refresh} isFetching={accounts.isFetching} />

      <div className="flex-1 space-y-8 overflow-y-auto p-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text">حسابات المحافظ</h2>
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-bg hover:opacity-90"
            >
              + إضافة محفظة
            </button>
          </div>
          <DataTable
            columns={accountColumns}
            data={accounts.data}
            loading={accounts.isLoading}
            error={accounts.error}
            getRowKey={(r) => r.wallet}
            emptyEmoji="💳"
            emptyTitle="لا توجد محافظ مسجلة"
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-text">سجل جميع المحافظ</h2>
          <DataTable columns={registryColumns} data={walletRegistry.data} loading={walletRegistry.isLoading} error={walletRegistry.error} getRowKey={(r) => r.id || r.wallet_number} emptyEmoji="👛" emptyTitle="لا توجد محافظ في السجل" />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-text">البنوك والحسابات المسجلة</h2>
          <DataTable columns={bankColumns} data={bankRegistry.data} loading={bankRegistry.isLoading} error={bankRegistry.error} getRowKey={(r) => r.id || `${r.bank_id}-${r.wallet_number}`} emptyEmoji="🏦" emptyTitle="لا توجد بنوك أو حسابات مسجلة" />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-text">ربط الأجهزة بالحسابات</h2>
          <DataTable
            columns={deviceMapColumns}
            data={deviceMap.data}
            loading={deviceMap.isLoading}
            error={deviceMap.error}
            getRowKey={(r) => r.to_account_number}
            emptyEmoji="📡"
            emptyTitle="لا توجد ربط بين الأجهزة والحسابات"
          />
        </section>
      </div>

      <Modal
        open={addOpen}
        onClose={() => !saving && setAddOpen(false)}
        title="إضافة محفظة جديدة"
        footer={
          <>
            <button
              onClick={() => setAddOpen(false)}
              disabled={saving}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text disabled:opacity-40"
            >
              إلغاء
            </button>
            <button
              onClick={submitNewAccount}
              disabled={saving}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-bg hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="المحفظة">
            <input
              value={newAccount.wallet}
              onChange={(e) => setNewAccount({ ...newAccount, wallet: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </Field>
          <Field label="المزود">
            <select
              value={newAccount.provider}
              onChange={(e) => setNewAccount({ ...newAccount, provider: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            >
              <option value="VodafoneCash">VodafoneCash</option>
              <option value="Orange Money">Orange Money</option>
              <option value="Mobile Wallet">Mobile Wallet</option>
            </select>
          </Field>
          <Field label="التاجر">
            <input
              value={newAccount.merchant}
              onChange={(e) => setNewAccount({ ...newAccount, merchant: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </Field>
          <Field label="اسم المحفظة">
            <input
              value={newAccount.wallet_name}
              onChange={(e) => setNewAccount({ ...newAccount, wallet_name: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </Field>
          <Field label="الشريحة">
            <input
              value={newAccount.sim_slot}
              onChange={(e) => setNewAccount({ ...newAccount, sim_slot: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </Field>
          <Field label="كود الجهاز">
            <input
              value={newAccount.device_code}
              onChange={(e) => setNewAccount({ ...newAccount, device_code: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </Field>
          <Field label="الحد اليومي">
            <input
              type="number"
              value={newAccount.daily_limit}
              onChange={(e) => setNewAccount({ ...newAccount, daily_limit: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
            />
          </Field>
          <div className="flex items-center gap-4 pt-5">
            <label className="flex items-center gap-2 text-sm text-text">
              <Switch checked={newAccount.active} onChange={(v) => setNewAccount({ ...newAccount, active: v })} />
              مفعّلة
            </label>
            <label className="flex items-center gap-2 text-sm text-text">
              <Switch
                checked={newAccount.auto_approve_enabled}
                onChange={(v) => setNewAccount({ ...newAccount, auto_approve_enabled: v })}
              />
              موافقة تلقائية
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      {children}
    </div>
  )
}
