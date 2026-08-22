'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { addDays, resolveWeekBounds, type DateFormat, type WeekScheme, type WeekStartDay } from '@/lib/dates'
import { WorkerSearchSelect } from '../../_components/WorkerSearchSelect'
import { DatePicker } from '@/components/DatePicker'
import { setPreferenceCookie } from '@/lib/clientCookie'

type Worker = { id: string; worker_code: string | null; name: string; is_active: boolean }

export function SlipSelector({
  workers,
  workerId,
  weekStart,
  weekEnd,
  currentWeekStart,
  weekStartDay,
  previousWeekStartDay,
  transitionDate,
  dateFormat,
}: {
  workers: Worker[]
  workerId?: string
  weekStart: string
  weekEnd: string
  currentWeekStart: string
  weekStartDay: WeekStartDay
  previousWeekStartDay: WeekStartDay | null
  transitionDate: string | null
  dateFormat: DateFormat
}) {
  const scheme: WeekScheme = { weekStartDay, previousWeekStartDay, transitionDate }
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
      <div className="shrink-0">
        <label htmlFor="weekStart" className="block text-sm font-medium">
          Date
        </label>
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => go({ weekStart: resolveWeekBounds(addDays(weekStart, -1), scheme).weekStart })}
            aria-label="Previous week"
            className="shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-sm hover:bg-zinc-50"
          >
            ‹
          </button>
          <div className="w-44">
            <DatePicker
              id="weekStart"
              value={weekStart}
              onChange={(v) => go({ weekStart: resolveWeekBounds(v, scheme).weekStart })}
              dateFormat={dateFormat}
            />
          </div>
          <button
            type="button"
            onClick={() => go({ weekStart: resolveWeekBounds(addDays(weekEnd, 1), scheme).weekStart })}
            aria-label="Next week"
            className="shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-sm hover:bg-zinc-50"
          >
            ›
          </button>
        </div>
      </div>
      <div className="shrink-0">
        {/* Doubles as a status indicator: green/disabled when the viewed
            week already is the current one, actionable otherwise — so it's
            obvious at a glance which week you're looking at relative to
            today without having to compare dates yourself. */}
        <button
          type="button"
          onClick={() => go({ weekStart: currentWeekStart })}
          disabled={weekStart === currentWeekStart}
          className={
            weekStart === currentWeekStart
              ? 'cursor-default rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium whitespace-nowrap text-emerald-700'
              : 'rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium whitespace-nowrap text-zinc-700 hover:bg-zinc-50'
          }
        >
          {weekStart === currentWeekStart ? 'Current week' : 'Go to current week'}
        </button>
      </div>
    </div>
  )
}
