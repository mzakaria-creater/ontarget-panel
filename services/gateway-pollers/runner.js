import { getRuntimeConfig } from './runtime-config.js'
import { gatewayHealth } from './gateway-client.js'
import { pollProvider } from './provider-poller.js'

const config = await getRuntimeConfig(); const apiKey = config.GATEWAY_API_KEY
if (!apiKey) throw new Error('GATEWAY_API_KEY is missing from maven_runtime_config')
const merchant = process.env.POLL_MERCHANT || config.POLL_MERCHANT || 'global'
const masterMerchant = process.env.POLL_MASTER_MERCHANT || config.POLL_MASTER_MERCHANT || 'global'
console.log('[gateway-poller] health', await gatewayHealth(apiKey))
for (const provider of ['maven', 'payfuture']) {
  try { console.log('[gateway-poller]', await pollProvider({ provider, config, apiKey, merchant, masterMerchant })) } catch (error) { console.error(`[gateway-poller] ${provider} failed`, error) }
}
