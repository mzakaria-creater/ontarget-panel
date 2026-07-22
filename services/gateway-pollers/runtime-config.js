const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

export async function getRuntimeConfig() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  const response = await fetch(`${SUPABASE_URL}/rest/v1/maven_runtime_config?select=name,value,config_value,secret_value`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } })
  if (!response.ok) throw new Error(`Runtime config request failed: ${response.status}`)
  const rows = await response.json(); const config = {}
  for (const row of rows) config[row.name] = row.value ?? row.config_value ?? row.secret_value
  return config
}
