const ALLOWED_PATHS = new Set(['health', 'merchants/overview', 'wallets/overview'])

function readBody(req) {
  return new Promise((resolve, reject) => { const chunks = []; req.on('data', (chunk) => chunks.push(chunk)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject) })
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url || '/', 'http://vercel.local')
    const path = String(url.searchParams.get('path') || '').replace(/^\/+|\/+$/g, '')
    if (!ALLOWED_PATHS.has(path)) return res.status(400).json({ error: 'Unsupported gateway path' })
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SECRET_KEY
    if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Supabase server configuration is missing' })
    const configResponse = await fetch(`${supabaseUrl}/rest/v1/maven_runtime_config?name=eq.GATEWAY_API_KEY&owner_name=eq.global&select=*`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } })
    const configRows = await configResponse.json()
    const gatewayKey = configRows?.[0]?.value || configRows?.[0]?.config_value || configRows?.[0]?.secret_value
    if (!gatewayKey) return res.status(503).json({ error: 'GATEWAY_API_KEY is not configured' })
    const query = new URLSearchParams(url.searchParams); query.delete('path')
    const response = await fetch(`${supabaseUrl}/functions/v1/gateway-api/${path}${query.toString() ? `?${query}` : ''}`, { method: req.method, headers: { Authorization: `Bearer ${gatewayKey}`, Accept: 'application/json', 'Content-Type': 'application/json' }, body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readBody(req) })
    res.status(response.status).setHeader('Content-Type', response.headers.get('content-type') || 'application/json').send(await response.text())
  } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : 'Gateway proxy failed' }) }
}
