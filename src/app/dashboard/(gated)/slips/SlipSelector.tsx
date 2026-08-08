'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { WorkerSearchSelect } from '../../_components/WorkerSearchSelect'

type Worker = { id: string; worker_code: string; name: string; is_active: boolean }

export function SlipSelector({
  workers,
  workerId,
  weekStart,
}: {
  workers: Worker[]
  workerId?: string
  weekStart: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function go(next: { workerId?: string; weekStart?: string }) {
    const nextWorkerId = next.workerId ?? workerId ?? ''
    const nextWeekStart = next.weekStart ?? weekStart
    // Preserve the "Find records" filter section's own (differently
    // namespaced) query params instead of wiping the whole query string.
    const params = new URLSearchParams(searchParams.toString())
    if (nextWorkerId) params.set('workerId', nextWorkerId)
    else params.delete('workerId')
    params.set('weekStart', nextWeekStart)
    router.push(`/dashboard/slips?${params.toString()}`)
  }

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3 print:hidden">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="worker-select" className="block text-sm font-medium">
          Worker
        </label>
        <div className="mt-1">
          <WorkerSearchSelect
            id="worker-select"
            workers={workers}
            value={workerId ?? ''}
            onChange={(id) => go({ workerId: id })}
            placeholder="Search worker by name or ID"
            allowAll={false}
          />
        </div>
      </div>
      <div className="w-44">
        <label htmlFor="weekStart" className="block text-sm font-medium">
          Week starting
        </label>
        <input
          id="weekStart"
          type="date"
          defaultValue={weekStart}
          onChange={(e) => go({ weekStart: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
    </div>
  )
}
