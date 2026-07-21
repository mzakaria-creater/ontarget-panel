import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setLoading(false) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) setError('تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.')
    setSubmitting(false)
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">جاري التحقق من الجلسة...</div>
  if (session) return children

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-bg px-6 text-text">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-gold" /><div><div className="text-xl font-extrabold">OnTarget</div><div className="mt-1 text-sm text-muted">لوحة عمليات الدفع</div></div></div>
        <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
        <p className="mt-2 text-sm text-muted">استخدم حساب موظف مصرح له للوصول إلى لوحة التحكم.</p>
        <label className="mt-7 block text-sm text-muted">البريد الإلكتروني</label>
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-text outline-none focus:border-gold" autoComplete="email" />
        <label className="mt-4 block text-sm text-muted">كلمة المرور</label>
        <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-text outline-none focus:border-gold" autoComplete="current-password" />
        {error && <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        <button disabled={submitting} className="mt-6 w-full rounded-xl bg-gold px-4 py-3 font-bold text-bg transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">{submitting ? 'جاري الدخول...' : 'دخول'}</button>
      </form>
    </main>
  )
}
