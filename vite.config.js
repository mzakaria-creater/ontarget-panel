import { defineConfig, loadEnv } from 'vite'
import fs from 'node:fs'
import { URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const reportPath = '/Users/mz/Downloads/ontarget-full-report (1).html'
const walletReportPath = '/Users/mz/Downloads/ngpay-wallets-report.html'
const reportResources = new Set([
  'v_wallet_financial_summary',
  'v_wallet_daily_activity',
  'v_wallet_recent_transactions',
  'v_wallet_sms_reconciliation',
  'v_wallet_outgoing_live',
  'v_outgoing_top_recipients',
])
const appResources = new Set([
  'maven_transactions',
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
  ...reportResources,
])

function reportPlugin(env) {
  return {
    name: 'ontarget-report-page',
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
      server.middlewares.use('/api/report-data', async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://localhost')
          const queryPath = url.searchParams.get('path') || ''
          const resource = queryPath.split('?')[0].split('/')[0]
          if (!reportResources.has(resource)) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Unsupported report resource' }))
            return
          }

          const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${queryPath}`, {
            headers: {
              apikey: env.SUPABASE_SECRET_KEY,
              Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
              Accept: 'application/json',
            },
          })
          res.statusCode = response.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(await response.text())
        } catch (error) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Report data request failed' }))
        }
      })
      server.middlewares.use('/report.html', (_req, res, next) => {
        if (!fs.existsSync(reportPath)) return next()
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        fs.createReadStream(reportPath).pipe(res)
      })
      server.middlewares.use('/ngpay-wallets-report.html', (_req, res, next) => {
        if (!fs.existsSync(walletReportPath)) return next()
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        fs.createReadStream(walletReportPath).pipe(res)
      })
    },
    generateBundle() {
      if (fs.existsSync(reportPath)) {
        this.emitFile({ type: 'asset', fileName: 'report.html', source: fs.readFileSync(reportPath, 'utf8') })
      }
      if (fs.existsSync(walletReportPath)) {
        this.emitFile({ type: 'asset', fileName: 'ngpay-wallets-report.html', source: fs.readFileSync(walletReportPath, 'utf8') })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  base: './',
  plugins: [react(), tailwindcss(), reportPlugin(env)],
  build: {
    outDir: 'dist',
  },
  }
})
