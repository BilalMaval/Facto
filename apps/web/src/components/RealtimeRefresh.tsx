'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeSubscription } from '@/lib/realtimeSubscriptions'

// Mounted once per layout (dashboard/admin). Refreshes the current route's
// Server Components whenever a subscribed change comes in, so data shows up
// live on both sides. The payload itself is never read (RLS still governs
// what the refetch actually returns), so this is safe even where unfiltered.
export function RealtimeRefresh({ subscriptions }: { subscriptions: RealtimeSubscription[] }) {
  const router = useRouter()
  const key = subscriptions.map((s) => `${s.table}:${s.filter ?? ''}`).join(',')

  useEffect(() => {
    const supabase = createClient()
    let timeout: ReturnType<typeof setTimeout> | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => router.refresh(), 200)
    }

    // Realtime's postgres_changes evaluates RLS as the connecting user, but
    // the session JWT has to be handed to the realtime connection
    // explicitly — it isn't picked up automatically just because the same
    // client instance also handles auth. Without this, the channel joins
    // successfully but every change gets silently filtered out by RLS.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      let ch = supabase.channel('realtime-refresh')
      for (const { table, filter } of subscriptions) {
        ch = ch.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
          scheduleRefresh
        )
      }
      ch.subscribe()
      channel = ch
    })

    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return null
}
