const ALLOWED_RESOURCES = new Set([
  'maven_transactions', 'transactions',
  'browser_jobs',
  'api_risk_blacklist',
  'tx_complaints',
  'maven_transaction_history',
  'telegram_updates',
  'telegram_alerts',
  'telegram_config',
  'bot_sessions',
  'panel_users',
  'panel_permissions',
  'roles',
  'review_queue',
  'inbound_sms',
  'wallet_accounts',
  'wallet_device_map',
  'wallet_registry',
  'wallet_master_list',
  'merchant_bank_registry',
  'automation_settings',
  'automation_audit_log',
  'v_wallet_financial_summary',
  'v_wallet_daily_activity',
  'v_wallet_recent_transactions',
  'v_wallet_sms_reconciliation',
  'v_wallet_outgoing_live',
  'v_outgoing_top_recipients',
  'v_report_daily',
  'v_report_wallets',
  'v_report_outgoing',
  'v_automation_stats',
  'v_client_balance_summary',
  'v_payin_with_client_history',
])

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  try {
    const requestUrl = new URL(req.url || '/', 'http://vercel.local')
    const rewrittenPath = requestUrl.searchParams.get('path')
    const rawPath = (rewrittenPath || requestUrl.pathname.replace(/^\/api\/supabase/, '')).split('?')[0]
    const resourcePath = rawPath.replace(/^\/rest\/v1\//, '').replace(/^\/+/, '').split('/')[0]
    if (!ALLOWED_RESOURCES.has(resourcePath)) {
      res.status(400).json({ error: 'Unsupported Supabase resource' })
      return
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!supabaseUrl || (!secretKey && !req.headers.apikey)) {
      res.status(500).json({ error: 'Supabase environment variables are missing' })
      return
    }

    const upstreamPath = rawPath.startsWith('/rest/v1/') ? rawPath : `/rest/v1${rawPath}`
    const headers = {
      apikey: secretKey || req.headers.apikey,
      Authorization: `Bearer ${secretKey || req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers.apikey}`,
      Accept: req.headers.accept || 'application/json',
      'Content-Type': req.headers['content-type'] || 'application/json',
    }
    if (req.headers.prefer) headers.Prefer = req.headers.prefer

    const upstreamQuery = new URLSearchParams(requestUrl.searchParams)
    upstreamQuery.delete('path')
    const queryString = upstreamQuery.toString()
    const response = await fetch(`${supabaseUrl}${upstreamPath}${queryString ? `?${queryString}` : ''}`, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readBody(req),
    })
    res.status(response.status)
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8')
    res.send(await response.text())
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Supabase proxy request failed' })
  }
}
