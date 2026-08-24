import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/database.types'
import { fetchWithTimeout } from '@/lib/supabase/timeoutFetch'
import '@/lib/supabase/envGuard'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: fetchWithTimeout() } }
  )
}
