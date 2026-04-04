import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

let client: SupabaseClient | null = null

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Share auth session with Zeiterfassung (same storageKey)
      storageKey: 'zeiterfassung_auth',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })
} else {
  console.warn('Supabase credentials missing – running in offline/local mode')
}

export const supabaseClient = client

export function isSupabaseAvailable(): boolean {
  return client !== null
}

export async function ensureValidSession(): Promise<boolean> {
  if (!client) return false
  try {
    const { data: { session } } = await client.auth.getSession()
    if (!session) return false
    const expiresAt = session.expires_at || 0
    if (expiresAt * 1000 - Date.now() < 60000) {
      const { data, error } = await client.auth.refreshSession()
      if (error || !data.session) return false
    }
    return true
  } catch {
    return false
  }
}
