import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

const proxiedFetch = (input, init) => {
  const target = new URL(input instanceof Request ? input.url : input, window.location.origin)
  if (target.origin === supabaseUrl && target.pathname.startsWith('/rest/v1/')) {
    // Keep the Vercel function path to one segment; Vercel's catch-all route
    // does not reliably match the deeper /rest/v1/<resource> URL.
    const resourcePath = target.pathname.replace(/^\/rest\/v1\//, '')
    const proxyPath = `/api/supabase/${resourcePath}${target.search}`
    if (input instanceof Request && !init) return window.fetch(new Request(proxyPath, input))
    return window.fetch(proxyPath, init)
  }
  return window.fetch(input, init)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: proxiedFetch } })

export const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`
