'use client'

import { useEffect } from 'react'
import { initOfflineQueue, syncNow, dismissConflict, useOfflineQueueStatus } from '@/lib/offlineQueue/webAppWiring'

// Renders nothing when there's nothing to say — online, empty queue, no
// conflicts — matching this app's existing "no toast library, only show
// feedback when there's actually something to report" convention.
export function OfflineQueueBanner() {
  useEffect(() => {
    initOfflineQueue()
  }, [])

  const { online, pending, syncing, conflicts } = useOfflineQueueStatus()

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
