const METHODS = [
  { test: /vodafone|vf|فودافون/i, short: 'VF', label: 'Vodafone Cash', color: 'bg-red-600' },
  { test: /orange|أورنج|اورنج/i, short: 'OC', label: 'Orange Cash', color: 'bg-orange-500' },
  { test: /etisalat|e&|اتصالات/i, short: 'EC', label: 'Etisalat Cash', color: 'bg-green-600' },
  { test: /insta|انستا/i, short: 'IP', label: 'InstaPay', color: 'bg-blue-600' },
  { test: /fawry|فوري/i, short: 'FP', label: 'Fawry Pay', color: 'bg-yellow-500' },
  { test: /bank|بنكي|تحويل/i, short: 'BK', label: 'Bank Transfer', color: 'bg-slate-600' },
]
const VODAFONE_LOGO = 'https://play-lh.googleusercontent.com/4QVlsh05iViW5gwQ6-jtt3uQr4phvlu1Rb1vy5IgiGHsni8KTMMREZChjsnw8851OvjzplyUoRxOAUU3SsWbVg'
const ORANGE_LOGO = 'https://orange.africa-newsroom.com/files/large/38431ecc435429a/200/200'
const INSTAPAY_LOGO = 'https://play-lh.googleusercontent.com/_ks0_XUbrZOkeiXkjaiZEK1S-j1skuQgF1E8S3ff702CoVyaiGnbfXPK74WjgxMk0Q4v2hlhu8WTHxp52Wq0'

export function paymentMethodMeta(value) {
  const raw = String(value || '').trim()
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('012')) return { short: 'OC', label: 'Orange Cash', color: 'bg-orange-500', logo: ORANGE_LOGO }
  const method = METHODS.find((item) => item.test.test(raw))
  return method?.short === 'IP' ? { ...method, logo: INSTAPAY_LOGO } : method || { short: '—', label: raw || 'غير محدد', color: 'bg-slate-500' }
}

export default function PaymentMethodBadge({ value }) {
  const method = paymentMethodMeta(value)
  return <span className="inline-flex items-center gap-2 whitespace-nowrap" title={method.label}>
    {method.short === 'VF' || method.logo ? <img src={method.logo || VODAFONE_LOGO} alt={method.label} className="h-7 w-7 rounded-lg object-cover shadow-sm" /> : <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black text-white shadow-sm ${method.color}`}>{method.short}</span>}
    <span className="text-xs font-semibold text-text">{method.label}</span>
  </span>
}
