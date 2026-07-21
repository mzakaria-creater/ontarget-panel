import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatAbsoluteDate, formatRelativeTime } from '../utils/format'
import { useToast } from '../components/Toast'
import Topbar from '../components/Topbar'
import Switch from '../components/Switch'

const GROUPS = [
  { title: 'التشغيل العام', description: 'تحكم في محرك الأتمتة ومصادر المعالجة.', toggles: [
    { key: 'automation_enabled', label: 'تفعيل الأتمتة بالكامل' },
    { key: 'ngpay_enabled', label: 'تشغيل NGPay' },
    { key: 'maven_enabled', label: 'تشغيل Maven' },
    { key: 'turbo_mode', label: 'الوضع السريع Turbo' },
  ]},
  { title: 'المطابقة والتحقق', description: 'قواعد مطابقة المعاملة برسائل SMS وبيانات المحفظة.', toggles: [
    { key: 'balance_check_enabled', label: 'التحقق من الرصيد' },
    { key: 'use_crm_name_matching', label: 'مطابقة الاسم عبر CRM' },
    { key: 'use_near_amount_matching', label: 'مطابقة المبلغ التقريبي' },
    { key: 'use_unique_amount_matching', label: 'مطابقة المبلغ الفريد' },
    { key: 'use_trxid_matching', label: 'مطابقة رقم العملية' },
    { key: 'use_balance_timing_matching', label: 'مطابقة توقيت الرصيد' },
    { key: 'use_direct_field_matching', label: 'المطابقة المباشرة للحقول' },
    { key: 'use_account_number_matching', label: 'مطابقة رقم الحساب' },
  ]},
  { title: 'الحماية والمراجعة', description: 'قواعد الأمان والتحويل للمراجعة اليدوية.', toggles: [
    { key: 'security_rules_enabled', label: 'تفعيل قواعد الأمان' },
    { key: 'above_limit_to_manual', label: 'تحويل ما يتجاوز الحد للمراجعة اليدوية' },
    { key: 'wallet_switch_auto_enabled', label: 'تبديل المحفظة تلقائياً' },
  ]},
  { title: 'OCR والتحقق المرئي', description: 'خيارات قراءة إثباتات الدفع والتحقق من بيانات المحفظة.', toggles: [
    { key: 'use_wallet_verify_ocr', label: 'التحقق من المحفظة عبر OCR' },
    { key: 'use_nameonly_ocr_matching', label: 'مطابقة الاسم فقط عبر OCR' },
  ]},
]

export default function Settings() {
  const { showToast } = useToast()
  const [local, setLocal] = useState(null)
  const [savingKey, setSavingKey] = useState(null)
  const [operator, setOperator] = useState(() => localStorage.getItem('ontarget-operator') || 'Operator')

  const settingsQuery = useRealtimeTable({
    key: ['automation-settings'],
    queryFn: async (sb) => {
      const { data, error } = await sb.from('automation_settings').select('*').eq('id', 1).maybeSingle()
      return { data: data ? [data] : [], error }
    },
    intervalMs: 30000,
  })

  const remote = settingsQuery.data?.[0] || null
  const auditQuery = useRealtimeTable({
    key: ['automation-audit-log'],
    queryFn: async (sb) => {
      const { data, error } = await sb.from('automation_audit_log').select('*').order('created_at', { ascending: false }).limit(200)
      return { data: data || [], error }
    },
    intervalMs: 5000,
  })
  const auditRows = useMemo(() => auditQuery.data || [], [auditQuery.data])

  useEffect(() => {
    if (remote && !savingKey) setLocal(remote)
  }, [remote, savingKey])

  async function updateField(key, value) {
    const previous = local?.[key]
    setLocal((prev) => ({ ...prev, [key]: value }))
    setSavingKey(key)

    const { error } = await supabase.from('automation_settings').update({ [key]: value }).eq('id', 1)

    setSavingKey(null)

    if (error) {
      showToast(`فشل تحديث الإعداد: ${error.message}`, 'error')
      setLocal(remote)
    } else {
      const auditError = await supabase.from('automation_audit_log').insert({
        action: key === 'automation_enabled' ? (value ? 'automation_enabled' : 'automation_disabled') : 'automation_setting_changed',
        setting_key: key,
        old_value: previous,
        new_value: value,
        changed_by: operator,
        source: 'settings_panel',
      }).then(({ error: insertError }) => insertError)
      if (auditError) console.warn('Automation audit could not be saved:', auditError.message)
      showToast('تم حفظ الإعداد', 'success')
      settingsQuery.refresh()
      auditQuery.refresh()
    }
  }

  if (settingsQuery.error) {
    return (
      <div className="flex h-full flex-col">
        <Topbar title="الإعدادات" subtitle="ضبط قواعد المطابقة والأتمتة" onRefresh={settingsQuery.refresh} />
        <div className="flex-1 p-6">
          <div className="rounded-2xl border border-danger/30 bg-danger/5 p-6 text-center text-sm text-muted">
            تعذر تحميل الإعدادات — {String(settingsQuery.error.message || settingsQuery.error)}
          </div>
        </div>
      </div>
    )
  }

  if (settingsQuery.isLoading || !local) {
    return (
      <div className="flex h-full flex-col">
        <Topbar title="الإعدادات" subtitle="ضبط قواعد المطابقة والأتمتة" />
        <div className="flex-1 p-6 text-sm text-muted">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Topbar
        title="الإعدادات"
        subtitle="ضبط قواعد المطابقة والأتمتة"
        onRefresh={settingsQuery.refresh}
        isFetching={settingsQuery.isFetching}
      />

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted">
            آخر تحديث:{' '}
            <span title={formatAbsoluteDate(local.updated_at)} className="text-text">
              {formatRelativeTime(local.updated_at)}
            </span>
          </div>
        </div>

        <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${local.automation_enabled ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}>
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${local.automation_enabled ? 'bg-success/15' : 'bg-warning/15'}`}>{local.automation_enabled ? '⚡' : '⏸'}</div>
            <div><h2 className="text-base font-bold text-text">المفتاح الرئيسي للأتمتة</h2><p className="mt-1 text-sm text-muted">{local.automation_enabled ? 'محرك الأتمتة يعمل حالياً' : 'الأتمتة متوقفة — المعالجة اليدوية فقط'}</p></div>
          </div>
          <Switch checked={!!local.automation_enabled} onChange={(value) => updateField('automation_enabled', value)} disabled={savingKey === 'automation_enabled'} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { key: 'max_auto_amount', label: 'الحد الأقصى للمبلغ التلقائي', suffix: 'EGP' },
            { key: 'decline_grace_minutes', label: 'مهلة الرفض', suffix: 'دقيقة' },
            { key: 'score_threshold', label: 'حد درجة المطابقة', suffix: '%' },
          ].map((field) => <div key={field.key} className="rounded-2xl border border-border bg-card p-4"><label className="mb-3 block text-sm font-bold text-text">{field.label}</label><div className="flex items-center gap-2"><input type="number" value={local[field.key] ?? ''} onChange={(e) => setLocal({ ...local, [field.key]: Number(e.target.value) })} onBlur={(e) => updateField(field.key, Number(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && updateField(field.key, Number(e.target.value))} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /><span className="text-xs text-muted">{field.suffix}</span></div></div>)}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {GROUPS.map((group) => <section key={group.title} className="overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-4 py-4"><h2 className="text-sm font-bold text-text">{group.title}</h2><p className="mt-1 text-xs text-muted">{group.description}</p></div><div className="divide-y divide-border">{group.toggles.map((toggle) => <div key={toggle.key} className="flex items-center justify-between gap-4 px-4 py-3.5"><span className="text-sm text-text">{toggle.label}</span><Switch checked={!!local[toggle.key]} onChange={(value) => updateField(toggle.key, value)} disabled={savingKey === toggle.key} /></div>)}</div></section>)}
        </div>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
            <div><h2 className="text-sm font-bold text-text">سجل الأتمتة</h2><p className="mt-1 text-xs text-muted">كل تشغيل أو إيقاف أو تغيير إعداد مع المنفذ ووقت التغيير.</p></div>
            <div className="flex items-center gap-2"><span className="text-xs text-muted">المنفذ الحالي</span><input value={operator} onChange={(event) => { setOperator(event.target.value); localStorage.setItem('ontarget-operator', event.target.value) }} className="w-36 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text" /></div>
          </div>
          <div className="overflow-x-auto">
            {auditQuery.error ? <div className="p-4 text-sm text-warning">تعذر تحميل سجل الأتمتة: {auditQuery.error.message}</div> : auditRows.length ? <table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted"><th className="px-4 py-3">الإجراء</th><th className="px-4 py-3">الإعداد</th><th className="px-4 py-3">قبل</th><th className="px-4 py-3">بعد</th><th className="px-4 py-3">بواسطة</th><th className="px-4 py-3">الوقت</th></tr></thead><tbody>{auditRows.map((row) => <tr key={row.id} className="border-b border-border last:border-0"><td className="px-4 py-3 font-semibold text-gold">{row.action}</td><td className="px-4 py-3 text-text">{row.setting_key || '—'}</td><td className="px-4 py-3 text-muted">{row.old_value == null ? '—' : String(row.old_value)}</td><td className="px-4 py-3 text-text">{row.new_value == null ? '—' : String(row.new_value)}</td><td className="px-4 py-3 text-text">{row.changed_by || 'Operator'}</td><td className="px-4 py-3 text-muted" title={formatAbsoluteDate(row.created_at)}>{formatRelativeTime(row.created_at)}</td></tr>)}</tbody></table> : <div className="p-4 text-sm text-muted">لا توجد تغييرات مسجلة حتى الآن.</div>}
          </div>
        </section>
      </div>
    </div>
  )
}
