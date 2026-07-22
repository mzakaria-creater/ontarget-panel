const ALLOWED_RESOURCES = new Set([
  'maven_transactions', 'transactions', 'browser_jobs', 'api_risk_blacklist', 'tx_complaints',
  'maven_transaction_history', 'telegram_updates', 'telegram_alerts', 'telegram_config',
  'bot_sessions', 'panel_users', 'panel_permissions', 'roles', 'review_queue',
  'inbound_sms', 'wallet_accounts', 'wallet_device_map', 'wallet_registry',
  'wallet_master_list', 'merchant_bank_registry', 'automation_settings',
  'automation_audit_log', 'v_wallet_financial_summary', 'v_wallet_daily_activity',
  'v_wallet_recent_transactions', 'v_wallet_sms_reconciliation', 'v_wallet_outgoing_live',
  'v_outgoing_top_recipients', 'v_report_daily', 'v_report_wallets', 'v_report_outgoing',
  'v_automation_stats',
  'v_client_balance_summary', 'v_payin_with_client_history',
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
    const resource = requestUrl.searchParams.get('resource')
    if (!ALLOWED_RESOURCES.has(resource)) {
      res.status(400).json({ error: 'Unsupported Supabase resource' })
      return
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!supabaseUrl || !secretKey) {
      res.status(500).json({ error: 'Supabase environment variables are missing' })
      return
    }

    const query = new URLSearchParams(requestUrl.searchParams)
    query.delete('resource')
    const response = await fetch(`${supabaseUrl}/rest/v1/${resource}?${query}`, {
      method: req.method,
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        Accept: req.headers.accept || 'application/json',
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await readBody(req),
    })
    res.status(response.status)
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8')
    res.send(await response.text())
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Supabase proxy request failed' })
  }
}
