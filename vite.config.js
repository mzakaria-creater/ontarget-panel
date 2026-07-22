import { defineConfig, loadEnv } from 'vite'
import { URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const appResources = new Set([
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
  'v_client_balance_summary',
  'v_payin_with_client_history',
])

function appPlugin(env) {
  return {
    name: 'ontarget-app-proxy',
    configureServer(server) {
      server.middlewares.use('/api/maven-worker', async (req, res) => {
        try {
          const chunks = []
          req.on('data', (chunk) => chunks.push(chunk))
          req.on('end', async () => {
            const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/maven-http-worker`, {
              method: 'POST',
              headers: {
                apikey: env.SUPABASE_SECRET_KEY,
                Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
                'Content-Type': 'application/json',
              },
              body: Buffer.concat(chunks),
            })
            res.statusCode = response.status
            res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8')
            res.end(await response.text())
          })
        } catch (error) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Worker request failed' }))
        }
      })
      server.middlewares.use('/api/supabase', async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://localhost')
          const resource = url.pathname.split('/').filter(Boolean).pop()
          if (!appResources.has(resource)) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Unsupported Supabase resource' }))
            return
          }
          const body = ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : await new Promise((resolve) => {
            const chunks = []
            req.on('data', (chunk) => chunks.push(chunk))
            req.on('end', () => resolve(Buffer.concat(chunks)))
          })
          const upstreamPath = url.pathname.startsWith('/rest/v1/') ? url.pathname : `/rest/v1${url.pathname}`
          const response = await fetch(`${env.VITE_SUPABASE_URL}${upstreamPath}${url.search}`, {
            method: req.method,
            headers: {
              apikey: env.SUPABASE_SECRET_KEY,
              Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
              'Content-Type': req.headers['content-type'] || 'application/json',
              Prefer: req.headers.prefer || '',
            },
            body,
          })
          res.statusCode = response.status
          res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8')
          res.end(await response.text())
        } catch (error) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Supabase proxy request failed' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  base: './',
  plugins: [react(), tailwindcss(), appPlugin(env)],
  build: {
    outDir: 'dist',
  },
  }
})
