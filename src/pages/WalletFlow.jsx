import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRealtimeTable } from '../hooks/useRealtimeTable'
import { formatMoney, formatNumber } from '../utils/format'
import { useToast } from '../components/Toast'
import Topbar from '../components/Topbar'
import Modal from '../components/Modal'

const DEVICES = ['ont1', 'ont2', 'ont3', 'ont4', 'ont5', 'ont6']
const SNAPSHOT_KEY = 'ontarget-wallet-flow-snapshots'

function deviceName(value) {
  return String(value || '').toUpperCase()
}

function signedMoney(value) {
  const amount = Number(value || 0)
  return `${amount >= 0 ? '+' : ''}${formatMoney(amount)}`
}

export default function WalletFlow() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [simModal, setSimModal] = useState(null)
  const [simForm, setSimForm] = useState({ number: '', bankId: '' })
  const [saving, setSaving] = useState(false)
  const [snapshots, setSnapshots] = useState(() => { try { return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]') } catch { return [] } })

  const summary = useRealtimeTable({ key: ['wallet-flow-summary'], queryFn: async (sb) => sb.from('v_wallet_financial_summary').select('*').order('net_flow', { ascending: false }), intervalMs: 30000 })
  const deviceMap = useRealtimeTable({ key: ['wallet-flow-device-map'], queryFn: async (sb) => sb.from('wallet_device_map').select('*').order('device', { ascending: true }).order('sim_slot', { ascending: true }), intervalMs: 30000 })
  const registry = useRealtimeTable({ key: ['wallet-flow-registry'], queryFn: async (sb) => sb.from('wallet_registry').select('*').order('device', { ascending: true }), intervalMs: 30000 })

  const flowRows = useMemo(() => {
    const mappings = new Map((deviceMap.data || []).map((row) => [String(row.to_account_number), row]))
    return (summary.data || []).map((row) => ({ ...row, mapping: mappings.get(String(row.wallet)) })).filter((row) => Number(row.paid_amt || 0) || Number(row.out_amt || 0))
  }, [summary.data, deviceMap.data])

  const totals = useMemo(() => flowRows.reduce((acc, row) => ({ incoming: acc.incoming + Number(row.paid_amt || 0), outgoing: acc.outgoing + Number(row.out_amt || 0), net: acc.net + Number(row.net_flow || 0) }), { incoming: 0, outgoing: 0, net: 0 }), [flowRows])

  const deviceCards = useMemo(() => {
    const rows = deviceMap.data || []
    const registryRows = registry.data || []
    return DEVICES.map((device) => {
      const slots = [1, 2].map((slot) => rows.find((row) => deviceName(row.device) === deviceName(device) && Number(row.sim_slot) === slot) || null)
      const registryRow = registryRows.find((row) => deviceName(row.device) === deviceName(device))
      return { device, slots, registryRow }
    })
  }, [deviceMap.data, registry.data])

  function saveSnapshot() {
    const snapshot = { id: Date.now(), createdAt: new Date().toISOString(), totals, wallets: flowRows.length }
    const next = [snapshot, ...snapshots].slice(0, 20)
    setSnapshots(next)
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next))
    showToast('تم حفظ لقطة حركة المحافظ', 'success')
  }

  function openSim(device, slot, current) {
    setSimModal({ device, slot, current })
    setSimForm({ number: current?.to_account_number || '', bankId: current?.maven_bank_id || '' })
  }

  async function saveSim() {
    const number = simForm.number.trim()
    if (!simModal || !number) { showToast('رقم المحفظة / الشريحة مطلوب', 'error'); return }
    setSaving(true)
    const patch = { device: simModal.device, sim_slot: simModal.slot, maven_bank_id: simForm.bankId.trim() || null }
    const result = simModal.current
      ? await supabase.from('wallet_device_map').update(patch).eq('to_account_number', simModal.current.to_account_number)
      : await supabase.from('wallet_device_map').insert({ ...patch, to_account_number: number, auto_inferred: false })
    setSaving(false)
    if (result.error) { showToast(`فشل حفظ الشريحة: ${result.error.message}`, 'error'); return }
    showToast(simModal.current ? 'تم استبدال الشريحة' : 'تمت إضافة الشريحة', 'success')
    setSimModal(null)
    deviceMap.refresh()
  }

  return <div className="flex h-full flex-col bg-bg"><Topbar title="حركة المحافظ" subtitle="داخل وخارج وصافي — من 1 يوليو" onRefresh={() => { summary.refresh(); deviceMap.refresh(); registry.refresh() }} isFetching={summary.isFetching || deviceMap.isFetching} /><div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
    <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4 text-sm leading-7 text-text">ℹ️ لما محفظتين شاركوا نفس الجهاز، كل رسالة سحب بتتنسب لأقرب محفظة عندها معاملة إيداع فعلية قبلها مباشرة (مش تكرار عشوائي) — نتيجة تقريبية دقيقة لغاية ما نفصل الأرقام فعلياً على مستوى الجهاز.</div>
    <div className="flex flex-wrap gap-3"><button onClick={saveSnapshot} className="rounded-xl bg-gold px-4 py-3 text-sm font-bold text-bg">💾 حفظ لقطة دلوقتي</button><button onClick={() => document.getElementById('wallet-snapshots')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-text">📜 اللقطات المحفوظة ({snapshots.length})</button><button onClick={() => document.getElementById('sim-management')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-text">🔀 إدارة الشرايح (SIM)</button></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><div className="rounded-2xl border border-success/25 bg-success/5 p-5"><div className="text-xs text-muted">إجمالي الداخل</div><div className="mt-2 text-2xl font-black text-success">{formatMoney(totals.incoming)}</div></div><div className="rounded-2xl border border-danger/25 bg-danger/5 p-5"><div className="text-xs text-muted">إجمالي الخارج</div><div className="mt-2 text-2xl font-black text-danger">{formatMoney(totals.outgoing)}</div></div><div className="rounded-2xl border border-gold/25 bg-gold/5 p-5"><div className="text-xs text-muted">الصافي</div><div className="mt-2 text-2xl font-black text-gold">{signedMoney(totals.net)}</div></div></div>
    <section className="rounded-3xl border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Wallet flow · from 1 July</div><h2 className="mt-1 text-xl font-black text-text">💰 حركة المحافظ — داخل وخارج وصافي</h2></div><span className="text-xs text-muted">{formatNumber(flowRows.length)} محافظ</span></div><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[850px] text-sm"><thead className="bg-surface text-xs text-muted"><tr><th className="px-3 py-3 text-left">المحفظة</th><th className="px-3 py-3 text-left">الجهاز</th><th className="px-3 py-3 text-left">داخل</th><th className="px-3 py-3 text-left">خارج</th><th className="px-3 py-3 text-left">الصافي</th><th className="px-3 py-3 text-left">معاملات مدفوعة</th><th className="px-3 py-3 text-left">SMS%</th></tr></thead><tbody>{flowRows.map((row) => <tr key={row.wallet} className="border-t border-border"><td className="px-3 py-3 font-mono font-bold"><button onClick={() => navigate(`/monitor?wallet=${encodeURIComponent(row.wallet)}`)} className="text-gold underline decoration-dotted underline-offset-4 hover:text-text" title="عرض معاملات هذه المحفظة">{row.wallet}</button></td><td className="px-3 py-3">{row.mapping?.device ? deviceName(row.mapping.device) : '—'}</td><td className="px-3 py-3 font-bold text-success">{formatMoney(row.paid_amt)}</td><td className="px-3 py-3 font-bold text-danger">{formatMoney(row.out_amt)}</td><td className={`px-3 py-3 font-bold ${Number(row.net_flow) >= 0 ? 'text-gold' : 'text-danger'}`}>{signedMoney(row.net_flow)}</td><td className="px-3 py-3">{formatNumber(row.paid_tx)}</td><td className="px-3 py-3">{row.pct_sms_confirmed ?? 0}%</td></tr>)}</tbody></table></div></section>
    <section id="wallet-snapshots" className="rounded-3xl border border-border bg-card p-5"><h2 className="mb-4 text-lg font-black text-text">📜 اللقطات المحفوظة</h2>{snapshots.length ? <div className="grid gap-3 md:grid-cols-3">{snapshots.map((snapshot) => <div key={snapshot.id} className="rounded-xl border border-border bg-surface p-4"><div className="text-xs text-muted">{new Date(snapshot.createdAt).toLocaleString('en-GB')}</div><div className="mt-2 font-bold text-text">صافي {signedMoney(snapshot.totals.net)}</div><div className="mt-1 text-xs text-muted">داخل {formatMoney(snapshot.totals.incoming)} · خارج {formatMoney(snapshot.totals.outgoing)} · {snapshot.wallets} محافظ</div></div>)}</div> : <div className="rounded-xl bg-surface p-6 text-center text-sm text-muted">لا توجد لقطات محفوظة بعد</div>}</section>
    <section id="sim-management" className="rounded-3xl border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Device configuration</div><h2 className="mt-1 text-xl font-black text-text">🔀 الشرايح (SIM) لكل جهاز</h2></div><span className="text-xs text-muted">كل جهاز يأخذ شريحتين كحد أقصى</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{deviceCards.map(({ device, slots }) => <div key={device} className="rounded-2xl border border-border bg-surface p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-black text-gold">{deviceName(device)}</h3><span className="text-xs text-muted">{slots.filter(Boolean).length}/2 SIM</span></div><div className="space-y-3">{slots.map((slot, index) => <div key={index} className="rounded-xl border border-border bg-card p-3"><div className="flex items-start justify-between gap-3"><div>{slot ? <><div className="text-xs text-muted">شريحة {index + 1}</div><div className="mt-1 font-mono font-bold text-text">{slot.to_account_number}</div><div className="mt-1 text-xs text-muted">Bank ID: {slot.maven_bank_id || '—'}</div></> : <div className="text-sm text-muted">شريحة {index + 1} — فاضية</div>}</div><button onClick={() => openSim(device, index + 1, slot)} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-gold hover:border-gold/50">{slot ? '🔁 Replace SIM' : '➕ إضافة'}</button></div></div>)}</div></div>)}</div></section>
  </div>
  <Modal open={!!simModal} onClose={() => !saving && setSimModal(null)} title={`${simModal?.current ? 'Replace' : 'Add'} SIM · ${deviceName(simModal?.device)} · Slot ${simModal?.slot || ''}`} footer={<><button onClick={() => setSimModal(null)} disabled={saving} className="rounded-lg border border-border px-4 py-2 text-sm text-text">إلغاء</button><button onClick={saveSim} disabled={saving} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-bg">{saving ? 'جاري الحفظ...' : 'حفظ'}</button></>}><div className="space-y-4"><label className="block text-sm font-bold text-text">رقم الشريحة / المحفظة<input value={simForm.number} onChange={(e) => setSimForm({ ...simForm, number: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" inputMode="tel" /></label><label className="block text-sm font-bold text-text">Bank ID<input value={simForm.bankId} onChange={(e) => setSimForm({ ...simForm, bankId: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text" /></label></div></Modal>
  </div>
}
