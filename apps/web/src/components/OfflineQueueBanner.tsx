'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { initOfflineQueue, syncNow, dismissConflict, useOfflineQueueStatus } from '@/lib/offlineQueue/webAppWiring'

// Renders nothing when there's nothing to say — online, empty queue, no
// conflicts — matching this app's existing "no toast library, only show
// feedback when there's actually something to report" convention.
export function OfflineQueueBanner() {
  useEffect(() => {
    initOfflineQueue()
  }, [])

  const { online, pending, syncing, conflicts, reconnectedAt } = useOfflineQueueStatus()
  const router = useRouter()

  // Server Component data (org settings, a worker's slip, membership —
  // anything read via the last-known-good caches in queryCache.ts) only
  // ever refetches on a new request. Without this, coming back online left
  // every already-rendered page showing its stale fallback — including the
  // "can't reach the server" notice — until the user happened to navigate
  // or manually reload. reconnectedAt only changes on a real, confirmed
  // offline→online transition, so this can't fire on mount or re-render.
  //
  // Fires twice, not once: this component's own reachability probe (a
  // direct client→Supabase fetch) is entirely independent of the
  // server-side breaker in timeoutFetch.ts that Server Component data
  // fetches go through — the two don't share any state. A refresh
  // triggered the instant this probe succeeds can still land inside that
  // *other* breaker's own 10s cooldown from whatever failed moments
  // earlier server-side, and come back stale again with nothing left to
  // retry it — confirmed empirically, it doesn't self-heal by waiting.
  // The second, delayed refresh is a plain timing safety net: comfortably
  // past that cooldown by construction (10s), not a general retry-until-
  // confirmed loop, since the client has no way to see whether a given
  // refresh actually landed fresh data.
  const lastHandledReconnect = useRef(0)
  useEffect(() => {
    if (reconnectedAt === 0 || reconnectedAt === lastHandledReconnect.current) return
    lastHandledReconnect.current = reconnectedAt
    router.refresh()
    const retryTimer = setTimeout(() => router.refresh(), 12000)
    return () => clearTimeout(retryTimer)
  }, [reconnectedAt, router])

  if (online && pending === 0 && conflicts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
      {!online && pending === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow-sm">
          Offline — changes will be saved locally.
        </div>
      )}
      {pending > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow-sm">
          <span>
            {pending} change{pending === 1 ? '' : 's'} saved locally, waiting to sync
          </span>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing || !online}
            className="shrink-0 rounded border border-amber-400 px-2 py-1 text-xs font-medium disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      )}
      {conflicts.map((c) => (
        <div key={c.id} className="flex items-start justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 shadow-sm">
          <span>{c.message}</span>
          <button type="button" onClick={() => dismissConflict(c.id)} className="shrink-0 text-xs font-medium underline">
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}
