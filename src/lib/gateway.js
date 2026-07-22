export async function gatewayGet(path, params = {}) {
  const query = new URLSearchParams({ path, ...Object.fromEntries(Object.entries(params).filter(([, value]) => value != null && value !== '')) })
  const response = await fetch(`/api/gateway?${query}`)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Gateway request failed (${response.status})`)
  return body
}
