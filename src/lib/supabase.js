import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

// Table reads use Supabase's public Data API directly. The publishable/anon key
// is designed for browser use and is constrained by Supabase RLS policies.
// Sensitive server-only calls continue to use the Vercel API functions.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`
