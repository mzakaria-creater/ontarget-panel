const METHODS = [
  { test: /vodafone|vf|فودافون/i, short: 'VF', label: 'Vodafone Cash', color: 'bg-red-600' },
  { test: /orange|أورنج|اورنج/i, short: 'OC', label: 'Orange Cash', color: 'bg-orange-500' },
  { test: /etisalat|e&|اتصالات/i, short: 'EC', label: 'Etisalat Cash', color: 'bg-green-600' },
  { test: /insta|انستا/i, short: 'IP', label: 'InstaPay', color: 'bg-blue-600' },
  { test: /fawry|فوري/i, short: 'FP', label: 'Fawry Pay', color: 'bg-yellow-500' },
  { test: /bank|بنكي|تحويل/i, short: 'BK', label: 'Bank Transfer', color: 'bg-slate-600' },
]

export function paymentMethodMeta(value) {
  const raw = String(value || '').trim()
  return METHODS.find((method) => method.test.test(raw)) || { short: '—', label: raw || 'غير محدد', color: 'bg-slate-500' }
}

export default function PaymentMethodBadge({ value }) {
  const method = paymentMethodMeta(value)
  return <span className="inline-flex items-center gap-2 whitespace-nowrap" title={method.label}>
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black text-white shadow-sm ${method.color}`}>{method.short}</span>
    <span className="text-xs font-semibold text-text">{method.label}</span>
  </span>
}
