'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, type DateFormat } from '@/lib/dates'
import { WorkerSearchSelect } from '../../_components/WorkerSearchSelect'
import { DatePicker } from '@/components/DatePicker'
import { setPreferenceCookie } from '@/lib/clientCookie'

type Worker = { id: string; worker_code: string | null; name: string; is_active: boolean }

export function SlipSelector({
  workers,
  workerId,
  weekStart,
  dateFormat,
}: {
  workers: Worker[]
  workerId?: string
  weekStart: string
  dateFormat: DateFormat
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function go(next: { workerId?: string; weekStart?: string }) {
    const nextWorkerId = next.workerId ?? workerId ?? ''
    const nextWeekStart = next.weekStart ?? weekStart
    // Remembered so the plain "Weekly slips" nav link (no query params)
    // still lands back on the worker/week you were looking at, instead of
    // resetting every time you switch tabs and come back.
    if (nextWorkerId) setPreferenceCookie('slips_worker_id', nextWorkerId)
    setPreferenceCookie('slips_week_start', nextWeekStart)
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
      <div className="w-56">
        <label htmlFor="weekStart" className="block text-sm font-medium">
          Date
        </label>
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => go({ weekStart: addDays(weekStart, -7) })}
            aria-label="Previous week"
            className="rounded-md border border-zinc-300 px-2 py-2 text-sm hover:bg-zinc-50"
          >
            ‹
          </button>
          <DatePicker
            id="weekStart"
            value={weekStart}
            onChange={(v) => go({ weekStart: v })}
            dateFormat={dateFormat}
          />
          <button
            type="button"
            onClick={() => go({ weekStart: addDays(weekStart, 7) })}
            aria-label="Next week"
            className="rounded-md border border-zinc-300 px-2 py-2 text-sm hover:bg-zinc-50"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
