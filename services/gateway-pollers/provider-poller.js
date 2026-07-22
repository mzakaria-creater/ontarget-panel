import { getRuntimeConfig } from './runtime-config.js'
import { ingest } from './gateway-client.js'
import { HttpSession, parsePayload } from './http-session.js'
import { normalizeTransaction } from './normalizer.js'

async function login(session, url, username, password) {
  if (!url || !username || !password) return
  const response = await session.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, email: username }) })
  if (!response.ok) throw new Error(`Provider login failed (${response.status})`)
}

function resolveUrl(url, base) { if (!url) return undefined; try { return new URL(url, base || undefined).toString() } catch { return url } }
async function fetchList(session, url, base) { const target = resolveUrl(url, base); if (!target) return []; const response = await session.request(target, { headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error(`Provider list failed (${response.status}) ${target}`); return parsePayload(await response.json()) }

export async function pollProvider({ provider, config, apiKey, masterMerchant, merchant }) {
  const session = new HttpSession(); const prefix = provider === 'maven' ? 'MAVEN' : 'IGATEWAY'
  const base = config[`${prefix}_BASE_URL`] || (provider === 'maven' ? config.MAVEN_COLLECTOR_BASE : config.IGATEWAY_BASE_URL)
  const loginUrl = resolveUrl(config[`${prefix}_LOGIN_URL`] || (base ? `${base.replace(/\/$/, '')}/login` : undefined), base)
  await login(session, loginUrl, config[`${prefix}_USERNAME`] || config[`${prefix}_COLLECTOR_USERNAME`], config[`${prefix}_PASSWORD`] || config[`${prefix}_COLLECTOR_PASSWORD`])
  const endpoints = provider === 'maven' ? { payin: config.MAVEN_PAYIN_LIST_ENDPOINT || config.MAVEN_TRANSACTION_LIST_ENDPOINT, payout: config.MAVEN_P2P_PAYOUT_LIST_ENDPOINT } : { payin: config.IGATEWAY_PAYIN_TRANSACTION_URL, payout: config.IGATEWAY_PAYOUT_TRANSACTION_EGY_URL }
  let ingested = 0
  for (const [trxType, endpoint] of Object.entries(endpoints)) { for (const row of await fetchList(session, endpoint, base)) { const transaction = normalizeTransaction(row, { provider, trxType, masterMerchant, merchant }); if (!transaction.external_id) continue; await ingest(transaction, apiKey); ingested += 1 } }
  return { provider, ingested }
}
