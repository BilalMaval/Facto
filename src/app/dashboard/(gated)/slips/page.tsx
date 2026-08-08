import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { currentWeekStart, today as todayStr } from '@/lib/dates'
import { one } from '@/lib/one'
import { periodRange, periodLabel, type Period } from '@/lib/period'
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
    workerId,
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
  const weekStart = weekStartParam || currentWeekStart(org.week_start_day)

  const supabase = await createClient()
  const { data: workers } = await supabase
    .from('workers')
    .select('id, worker_code, name, is_active')
    .eq('organization_id', org.id)
    .order('worker_code')

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

      <SlipSelector workers={workers ?? []} workerId={workerId} weekStart={weekStart} />

      {workerId ? (
        <SlipView
          organizationId={org.id}
          orgName={org.name}
          workerId={workerId}
          weekStart={weekStart}
          canFinalize={canFinalize}
        />
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
          />
        </div>
        <SlipRecordsBrowser
          organizationId={org.id}
          range={range}
          period={period}
          workerId={searchWorkerId}
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
}: {
  organizationId: string
  range: { start: string; end: string }
  period: Period
  workerId?: string
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
        Showing weeks overlapping {periodLabel(period, range)}.
      </p>
      {!records?.length && <p className="mt-2 text-sm text-zinc-400">No weekly slip records found.</p>}
      <ul className="mt-2 divide-y divide-zinc-200">
        {records?.map((r) => {
          const worker = one<{ worker_code: string; name: string }>(r.worker)
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <span className="font-medium">{worker?.worker_code} — {worker?.name}</span>{' '}
                <span className="text-zinc-500">
                  · {r.week_start} to {r.week_end} ·{' '}
                  <span className={r.status === 'finalized' ? 'text-emerald-700' : 'text-amber-700'}>
                    {r.status}
                  </span>{' '}
                  · Work {Number(r.work_amount).toFixed(2)} · Paid {Number(r.paid_amount).toFixed(2)} · Payable{' '}
                  {Number(r.payable_balance).toFixed(2)}
                  {r.final_amount != null && ` · Final Paid ${Number(r.final_amount).toFixed(2)}`}
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
