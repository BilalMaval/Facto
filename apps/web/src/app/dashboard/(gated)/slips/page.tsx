import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import {
  addDays,
  currentWeekBounds,
  formatDate,
  resolveWeekBounds,
  today as todayStr,
  type DateFormat,
  type WeekScheme,
  type WeekStartDay,
} from '@/lib/dates'
import { one } from '@/lib/one'
import { periodRange, periodLabel, type Period } from '@/lib/period'
import { formatNumber, workerLabel } from '@/lib/format'
import { withLastKnownGood } from '@/lib/supabase/queryCache'
import { SlipSelector } from './SlipSelector'
import { SlipView } from './SlipView'
import { PeriodFilterBar } from '../../_components/PeriodFilterBar'

type SlipsPageSearchParams = {
  workerId?: string
  weekStart?: string
  error?: string
  searchPeriod?: string
  searchDate?: string
  searchStartDate?: string
  searchEndDate?: string
  searchWorkerId?: string
}

export default async function SlipsPage({
  searchParams,
}: {
  searchParams: Promise<SlipsPageSearchParams>
}) {
  const {
    workerId: workerIdParam,
    weekStart: weekStartParam,
    error,
    searchPeriod,
    searchDate,
    searchStartDate,
    searchEndDate,
    searchWorkerId,
  } = await searchParams
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')

  const org = membership.organization
  const canFinalize = membership.role === 'owner' || membership.role === 'admin'

  // Fall back to the last worker/week viewed (set by SlipSelector) when the
  // URL doesn't specify one — e.g. the plain "Weekly slips" nav link has no
  // query params, so switching tabs and back would otherwise reset to "pick
  // a worker and a week" every time.
  const cookieStore = await cookies()
  const workerId = workerIdParam || cookieStore.get('slips_worker_id')?.value
  const weekStartCookie = cookieStore.get('slips_week_start')?.value

  // A weekStart reaching this page (URL param, remembered cookie, or a
  // record's own "View" link) is always already a canonical week_start —
  // never re-derived here. Re-snapping it under the org's CURRENT
  // week_start_day would silently redirect old weeks to the wrong week
  // whenever that setting has ever been changed (e.g. Sat-Thu -> Mon-Sat),
  // since a week_start from before the change won't land on the new
  // scheme's anchor day. Snapping an arbitrary picked date to its week only
  // happens once, client-side in SlipSelector, at the moment it's picked.
  const scheme: WeekScheme = {
    weekStartDay: org.week_start_day as WeekStartDay,
    previousWeekStartDay: org.week_scheme_previous_start_day as WeekStartDay | null,
    transitionDate: org.week_scheme_transition_date,
  }
  const weekStart = weekStartParam || weekStartCookie || currentWeekBounds(scheme).weekStart
  // Only used to compute the prev/next nav targets below — SlipView derives
  // its own weekEnd authoritatively (an existing slip's stored value takes
  // priority over this fresh computation).
  const weekEnd = resolveWeekBounds(weekStart, scheme).weekEnd

  const supabase = await createClient()
  const { data: workers } = await withLastKnownGood(
    `slips:workers:${org.id}`,
    supabase
      .from('workers')
      .select('id, worker_code, name, is_active')
      .eq('organization_id', org.id)
      .order('worker_code')
  )

  const today = todayStr()
  const period: Period = (['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).includes(
    searchPeriod as Period
  )
    ? (searchPeriod as Period)
    : 'monthly'
  const date = searchDate || today
  const startDate = searchStartDate || date
  const endDate = searchEndDate || startDate
  const range = periodRange(period, date, startDate, endDate, org.week_start_day)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight print:hidden">Weekly slip</h1>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">
          {error}
        </p>
      )}

      <SlipSelector
        workers={workers ?? []}
        workerId={workerId}
        weekStart={weekStart}
        weekEnd={weekEnd}
        currentWeekStart={currentWeekBounds(scheme).weekStart}
        weekStartDay={scheme.weekStartDay}
        previousWeekStartDay={scheme.previousWeekStartDay}
        transitionDate={scheme.transitionDate}
        dateFormat={org.date_format as DateFormat}
      />

      {workerId ? (
        <div className="relative">
          <Link
            href={`/dashboard/slips?workerId=${workerId}&weekStart=${resolveWeekBounds(addDays(weekStart, -1), scheme).weekStart}`}
            aria-label="Previous week"
            scroll={false}
            className="absolute -left-10 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white p-2 text-sm leading-none shadow-sm hover:bg-zinc-50 print:hidden"
          >
            ‹
          </Link>
          <Link
            href={`/dashboard/slips?workerId=${workerId}&weekStart=${resolveWeekBounds(addDays(weekEnd, 1), scheme).weekStart}`}
            aria-label="Next week"
            scroll={false}
            className="absolute -right-10 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white p-2 text-sm leading-none shadow-sm hover:bg-zinc-50 print:hidden"
          >
            ›
          </Link>
          <SlipView
            organizationId={org.id}
            orgName={org.name}
            workerId={workerId}
            weekStart={weekStart}
            weekStartDay={scheme.weekStartDay}
            previousWeekStartDay={scheme.previousWeekStartDay}
            transitionDate={scheme.transitionDate}
            canFinalize={canFinalize}
            viewerRole={membership.role as 'owner' | 'admin' | 'staff'}
            currency={org.currency}
            dateFormat={org.date_format as DateFormat}
            showDecimals={org.show_decimals}
            standardDaysPerWeek={org.standard_days_per_week}
            standardHoursPerDay={org.standard_hours_per_day}
            overtimeRateMultiplier={org.overtime_rate_multiplier}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-zinc-400 print:hidden">
          Pick a worker and a week to view their slip.
        </p>
      )}

      <div className="mt-12 border-t border-zinc-200 pt-8 print:hidden">
        <h2 className="text-sm font-medium text-zinc-500">Find weekly slip records</h2>
        <div className="mt-2">
          <PeriodFilterBar
            basePath="/dashboard/slips"
            workers={workers ?? []}
            period={period}
            date={date}
            startDate={startDate}
            endDate={endDate}
            workerId={searchWorkerId ?? ''}
            paramPrefix="search"
            dateFormat={org.date_format as DateFormat}
          />
        </div>
        <SlipRecordsBrowser
          organizationId={org.id}
          range={range}
          period={period}
          workerId={searchWorkerId}
          dateFormat={org.date_format as DateFormat}
          showDecimals={org.show_decimals}
        />
      </div>
    </div>
  )
}

async function SlipRecordsBrowser({
  organizationId,
  range,
  period,
  workerId,
  dateFormat,
  showDecimals,
}: {
  organizationId: string
  range: { start: string; end: string }
  period: Period
  workerId?: string
  dateFormat: DateFormat
  showDecimals: boolean
}) {
  const supabase = await createClient()

  let query = supabase
    .from('weekly_slips')
    .select(
      'id, worker_id, week_start, week_end, status, work_amount, paid_amount, payable_balance, final_amount, worker:workers(worker_code, name)'
    )
    .eq('organization_id', organizationId)
    .lte('week_start', range.end)
    .gte('week_end', range.start)
    .order('week_start', { ascending: false })
  if (workerId) query = query.eq('worker_id', workerId)

  const { data: records } = await query

  return (
    <div className="mt-4">
      <p className="text-xs text-zinc-400">
        Showing weeks overlapping {periodLabel(period, range, dateFormat)}.
      </p>
      {!records?.length && <p className="mt-2 text-sm text-zinc-400">No weekly slip records found.</p>}
      <ul className="mt-2 divide-y divide-zinc-200">
        {records?.map((r) => {
          const worker = one<{ worker_code: string | null; name: string }>(r.worker)
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <span className="font-medium">{worker ? workerLabel(worker) : '—'}</span>{' '}
                <span className="text-zinc-500">
                  · {formatDate(r.week_start, dateFormat)} to {formatDate(r.week_end, dateFormat)} ·{' '}
                  <span className={r.status === 'finalized' ? 'text-emerald-700' : 'text-amber-700'}>
                    {r.status}
                  </span>{' '}
                  · Work {formatNumber(r.work_amount, showDecimals)} · Paid{' '}
                  {formatNumber(r.paid_amount, showDecimals)} · Payable {formatNumber(r.payable_balance, showDecimals)}
                  {r.final_amount != null && ` · Final Paid ${formatNumber(r.final_amount, showDecimals)}`}
                </span>
              </div>
              <Link
                href={`/dashboard/slips?workerId=${r.worker_id ?? ''}&weekStart=${r.week_start}`}
                className="text-zinc-900 underline hover:text-zinc-700"
              >
                View
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
