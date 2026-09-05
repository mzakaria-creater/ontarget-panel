import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { useToast } from '../components/Toast'
import Topbar from '../components/Topbar'
import Modal from '../components/Modal'
import { Building2, CreditCard, Download, Plus, Search, WalletCards } from 'lucide-react'

const METHODS = ['InstaPay', 'Vodafone Cash', 'Orange Cash', 'Etisalat Cash', 'Bank Transfer', 'Fawry', 'Other']
const EMPTY = { master_merchant: '', sub_merchant: '', payment_method: 'InstaPay', account_number: '', account_name: '', provider: '', notes: '', active: true }

function Field({ label, children }) {
  return <label className="block text-xs text-muted"><span>{label}</span>{children}</label>
}

export default function MerchantPaymentSetup() {
  const { showToast } = useToast()
  const [master, setMaster] = useState('all')
  const [sub, setSub] = useState('all')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const setup = useRealtimeTable({
    key: ['merchant-payment-setup'],
    queryFn: async (sb) => sb.from('merchant_payment_setup').select('*').order('master_merchant').order('sub_merchant').order('payment_method'),
    intervalMs: 30000,
  })
  const transactions = useRealtimeTable({
    key: ['merchant-payment-merchants'],
    queryFn: async (sb) => sb.from('maven_transactions').select('master_merchant, merchant, sub_merchant').not('master_merchant', 'is', null).limit(10000),
    intervalMs: 60000,
  })
  const liveSms = useRealtimeTable({
    key: ['merchant-payment-live-sms'],
    queryFn: async (sb) => sb.from('inbound_sms').select('id, receiver_number, wallet_number, confirmed_wallet_number, wallet, amount, received_at').gte('received_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).limit(10000),
    intervalMs: 30000,
  })

  const merchants = useMemo(() => {
    const map = new Map()
    for (const row of transactions.data || []) {
      const masterName = String(row.master_merchant || '').trim()
      const subName = String(row.sub_merchant || row.merchant || '').trim()
      if (!masterName || !subName) continue
      const key = `${masterName}::${subName}`
      if (!map.has(key)) map.set(key, { master_merchant: masterName, sub_merchant: subName })
    }
    for (const row of setup.data || []) {
      const key = `${row.master_merchant}::${row.sub_merchant}`
      if (!map.has(key)) map.set(key, { master_merchant: row.master_merchant, sub_merchant: row.sub_merchant })
    }
    return [...map.values()].sort((a, b) => `${a.master_merchant}${a.sub_merchant}`.localeCompare(`${b.master_merchant}${b.sub_merchant}`))
  }, [transactions.data, setup.data])

  const masters = [...new Set(merchants.map((row) => row.master_merchant))]
  const subs = merchants.filter((row) => master === 'all' || row.master_merchant === master).map((row) => row.sub_merchant)
  const rows = (setup.data || []).filter((row) => {
    const term = search.trim().toLowerCase()
    return (master === 'all' || row.master_merchant === master) && (sub === 'all' || row.sub_merchant === sub) && (!term || [row.master_merchant, row.sub_merchant, row.payment_method, row.account_number, row.account_name].join(' ').toLowerCase().includes(term))
  })
  const configuredMerchants = new Set(rows.map((row) => `${row.master_merchant}::${row.sub_merchant}`)).size
  const liveSmsWallets = useMemo(() => new Set((liveSms.data || []).flatMap((row) => [row.receiver_number, row.wallet_number, row.confirmed_wallet_number, row.wallet]).filter(Boolean).map((value) => String(value).replace(/\D/g, ''))), [liveSms.data])
  const liveSmsAccounts = new Set(rows.map((row) => String(row.account_number || '').replace(/\D/g, '')).filter((account) => account && liveSmsWallets.has(account))).size
  const liveSmsAmount = (liveSms.data || []).reduce((total, row) => total + Number(row.amount || 0), 0)

  function exportRows() {
    const headers = ['Master merchant', 'Sub-merchant', 'Payment method', 'Account', 'Provider', 'Account name', 'Active', 'Live SMS']
    const values = rows.map((row) => [row.master_merchant, row.sub_merchant, row.payment_method, row.account_number, row.provider || '', row.account_name || '', row.active ? 'Yes' : 'No', liveSmsWallets.has(String(row.account_number || '').replace(/\D/g, '')) ? 'Yes' : 'No'])
    const csv = [headers, ...values].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `merchant-payment-setup-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  async function save() {
    if (!form.master_merchant || !form.sub_merchant || !form.account_number) {
      showToast('التاجر الرئيسي والفرعي ورقم الحساب مطلوبة', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('merchant_payment_setup').upsert(form, { onConflict: 'master_merchant,sub_merchant,payment_method,account_number' })
    setSaving(false)
    if (error) { showToast(`فشل الحفظ: ${error.message}`, 'error'); return }
    showToast('تم حفظ إعداد الدفع', 'success')
    setAddOpen(false)
    setForm(EMPTY)
    setup.refresh()
  }

  async function toggle(row) {
    const { error } = await supabase.from('merchant_payment_setup').update({ active: !row.active, updated_at: new Date().toISOString() }).eq('id', row.id)
    if (error) showToast(`فشل تحديث الحالة: ${error.message}`, 'error')
    else { showToast('تم تحديث الحالة', 'success'); setup.refresh() }
  }

  return <div className="flex h-full flex-col">
    <Topbar title="إعداد دفع التجار" subtitle="طرق الدفع والحسابات لكل تاجر رئيسي وتاجر فرعي" onRefresh={setup.refresh} isFetching={setup.isFetching} actions={<div className="flex items-center gap-2"><button onClick={exportRows} disabled={!rows.length} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-text hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"><Download size={16} /> تصدير</button><button onClick={() => setAddOpen(true)} className="flex items-center gap-2 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-bg hover:opacity-90"><Plus size={16} /> إضافة إعداد</button></div>} />
    <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted"><Building2 size={15} /> التجار المهيئون</div><div className="mt-2 text-2xl font-bold text-gold">{configuredMerchants}</div></div>
        <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted"><CreditCard size={15} /> طرق الدفع</div><div className="mt-2 text-2xl font-bold text-gold">{new Set(rows.map((row) => row.payment_method)).size}</div></div>
        <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted"><WalletCards size={15} /> الحسابات</div><div className="mt-2 text-2xl font-bold text-gold">{new Set(rows.map((row) => row.account_number)).size}</div></div>
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4"><div className="flex items-center gap-2 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-success" /> Live SMS</div><div className="mt-2 text-2xl font-bold text-success">{liveSmsAccounts}</div><div className="mt-1 text-xs text-muted">{liveSms.data?.length || 0} SMS · {liveSmsAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP / 24h</div></div>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <label className="min-w-[240px] flex-1 text-xs text-muted"><span className="mb-1 flex items-center gap-2"><Search size={14} /> بحث</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="تاجر، طريقة أو حساب..." className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /></label>
        <Field label="التاجر الرئيسي"><select value={master} onChange={(e) => { setMaster(e.target.value); setSub('all') }} className="mt-1 min-w-48 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"><option value="all">كل التجار الرئيسيين</option>{masters.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
        <Field label="التاجر الفرعي"><select value={sub} onChange={(e) => setSub(e.target.value)} className="mt-1 min-w-48 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"><option value="all">كل التجار الفرعيين</option>{[...new Set(subs)].sort().map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[1050px] text-sm"><thead className="bg-surface text-xs text-muted"><tr><th className="px-4 py-3 text-right">التاجر الرئيسي</th><th className="px-4 py-3 text-right">التاجر الفرعي</th><th className="px-4 py-3 text-right">طريقة الدفع</th><th className="px-4 py-3 text-right">الحساب</th><th className="px-4 py-3 text-right">المزود / الاسم</th><th className="px-4 py-3 text-right">Live SMS</th><th className="px-4 py-3 text-right">الحالة</th><th className="px-4 py-3 text-right">إجراء</th></tr></thead><tbody>{rows.map((row) => { const account = String(row.account_number || '').replace(/\D/g, ''); const hasLiveSms = account && liveSmsWallets.has(account); return <tr key={row.id} className="border-t border-border"><td className="px-4 py-3 font-semibold">{row.master_merchant}</td><td className="px-4 py-3">{row.sub_merchant}</td><td className="px-4 py-3 font-medium">{row.payment_method}</td><td className="px-4 py-3 font-mono text-gold">{row.account_number}</td><td className="px-4 py-3 text-muted">{row.provider || '—'}{row.account_name ? ` · ${row.account_name}` : ''}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${hasLiveSms ? 'bg-success/15 text-success' : 'bg-surface text-muted'}`}>{hasLiveSms ? '● Live' : '—'}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.active ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>{row.active ? 'نشط' : 'موقوف'}</span></td><td className="px-4 py-3"><button onClick={() => toggle(row)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text hover:border-gold">{row.active ? 'إيقاف' : 'تفعيل'}</button></td></tr> })}{!rows.length && <tr><td colSpan="8" className="px-4 py-12 text-center text-sm text-muted">لا توجد إعدادات مطابقة للفلاتر</td></tr>}</tbody></table>
      </div>
      {setup.error && <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">تعذر تحميل إعدادات الدفع: {setup.error.message}</div>}
    </div>
    <Modal open={addOpen} onClose={() => !saving && setAddOpen(false)} title="إضافة إعداد دفع" footer={<><button onClick={() => setAddOpen(false)} disabled={saving} className="rounded-lg border border-border px-4 py-2 text-sm text-text">إلغاء</button><button onClick={save} disabled={saving} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-bg">{saving ? 'جاري الحفظ...' : 'حفظ'}</button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="التاجر الرئيسي"><input list="master-options" value={form.master_merchant} onChange={(e) => setForm({ ...form, master_merchant: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /><datalist id="master-options">{masters.map((item) => <option key={item} value={item} />)}</datalist></Field><Field label="التاجر الفرعي"><input list="sub-options" value={form.sub_merchant} onChange={(e) => setForm({ ...form, sub_merchant: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /><datalist id="sub-options">{subs.map((item) => <option key={item} value={item} />)}</datalist></Field><Field label="طريقة الدفع"><select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text">{METHODS.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="رقم الحساب / المحفظة"><input required value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono text-text" /></Field><Field label="اسم الحساب"><input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /></Field><Field label="المزود"><input placeholder="Orange / Vodafone / Bank" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /></Field><Field label="ملاحظات"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text sm:col-span-2" /></Field></div>
    </Modal>
  </div>
}
