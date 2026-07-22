const GATEWAY_URL = process.env.GATEWAY_API_URL || 'https://yvwppyoaksyhycimvgtw.supabase.co/functions/v1/gateway-api'

export async function ingest(transaction, apiKey) {
  const response = await fetch(`${GATEWAY_URL}/ingest`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(transaction) })
  if (!response.ok) throw new Error(`Gateway ingest failed (${response.status}): ${await response.text()}`)
  return response.json().catch(() => ({}))
}

export async function gatewayHealth(apiKey) {
  const response = await fetch(`${GATEWAY_URL}/health`, { headers: { Authorization: `Bearer ${apiKey}` } }); return { ok: response.ok, body: await response.text() }
}
