import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/supabase/database.types'
import { fetchWithTimeout } from '@/lib/supabase/timeoutFetch'
import '@/lib/supabase/envGuard'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout() },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // setAll is called from a Server Component when the session is
          // only being refreshed. Next.js forbids writing cookies there,
          // but middleware handles refreshing the session on every request,
          // so it's safe to ignore this failure.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // ignore — called from a Server Component
          }
        },
      },
    }
  )
}
