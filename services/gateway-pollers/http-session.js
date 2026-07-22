export class HttpSession {
  constructor() { this.cookies = new Map() }
  async request(url, options = {}) {
    const headers = new Headers(options.headers || {})
    if (this.cookies.size) headers.set('Cookie', [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; '))
    const response = await fetch(url, { ...options, headers, redirect: 'manual' })
    const setCookies = response.headers.getSetCookie?.() || []
    for (const cookie of setCookies) { const pair = cookie.split(';', 1)[0]; const [key, ...parts] = pair.split('='); if (key) this.cookies.set(key, parts.join('=')) }
    return response
  }
}

export function parsePayload(payload) {
  if (Array.isArray(payload)) return payload
  for (const key of ['data', 'items', 'results', 'transactions', 'payouts', 'rows', 'records']) if (Array.isArray(payload?.[key])) return payload[key]
  if (payload?.data && typeof payload.data === 'object') return parsePayload(payload.data)
  return []
}
