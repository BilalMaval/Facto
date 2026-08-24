import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import {
  addDays,
  currentWeekBounds,
  formatDate,
  formatTime,
  today as todayStr,
  type DateFormat,
  type WeekScheme,
  type WeekStartDay,
} from '@/lib/dates'
import { one } from '@/lib/one'
import { formatMoney, workerLabel } from '@/lib/format'
import { computeSalaryComponent, computeWorkAmount } from '@facto/payroll-core'
import { withLastKnownGood } from '@/lib/supabase/queryCache'
import { EntryForm } from './entries/EntryForm'
import { PaymentForm } from './entries/PaymentForm'
import { deleteEntry, deletePayment } from './entries/actions'
import { SlipView } from './slips/SlipView'
import { DashboardWorkerSelector } from './DashboardWorkerSelector'

type WorkerRef = { name: string; worker_code: string | null }
type WorkCodeRef = { code: string; description: string }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workerId?: string; error?: string }>
}) {
  const { workerId: workerIdParam, error } = await searchParams
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')

  // Falls back to the last worker viewed (set by DashboardWorkerSelector)
  // when the URL doesn't specify one — e.g. the plain "Dashboard" nav link
  // has no query params, so switching tabs and back would otherwise reset
  // to "no worker selected" every time. Re-validated below against this
  // org's actual active workers either way.
  const cookieStore = await cookies()
  const workerId = workerIdParam || cookieStore.get('dash_worker_id')?.value

  const org = membership.organization
  const canFinalize = membership.role === 'owner' || membership.role === 'admin'
  const scheme: WeekScheme = {
    weekStartDay: org.week_start_day as WeekStartDay,
    previousWeekStartDay: org.week_scheme_previous_start_day as WeekStartDay | null,
    transitionDate: org.week_scheme_transition_date,
  }
  const { weekStart, weekEnd } = currentWeekBounds(scheme)
  const today = todayStr()

  const supabase = await createClient()

  const [
    { data: activeWorkers },
    { data: workCodes },
    { data: weekEntries, error: weekEntriesError },
    { data: weekAttendance, error: weekAttendanceError },
    { data: outstandingWorkers },
    { data: recentEntries },
    { data: recentPayments },
  ] = await Promise.all([
    withLastKnownGood(
      `dashboard-home:workers:${org.id}`,
      supabase
        .from('workers')
        .select('id, worker_code, name, is_active, employment_type, weekly_salary')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('worker_code')
    ),
    withLastKnownGood(
      `dashboard-home:workCodes:${org.id}`,
      supabase
        .from('work_codes')
        .select('id, code, description, rate')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('code')
    ),
    // counted_week_start, not entry_date — a backdated/late entry can be
    // redirected to a different week than its raw date (see
    // resolveCountedWeekStart in entries/actions.ts); every other payroll
    // path in the app keys off counted_week_start for this same reason.
    supabase
      .from('work_entries')
      .select('worker_id, amount')
      .eq('organization_id', org.id)
      .eq('counted_week_start', weekStart),
    supabase
      .from('attendance')
      .select('worker_id, attendance_date, status, overtime_hours, overtime_wage, holiday_wage')
      .eq('organization_id', org.id)
      .gte('attendance_date', weekStart)
      .lte('attendance_date', weekEnd),
    supabase
      .from('workers')
      .select('id, worker_code, name, advance_balance')
      .eq('organization_id', org.id)
      .gt('advance_balance', 0)
      .order('advance_balance', { ascending: false })
      .limit(10),
    supabase
      .from('work_entries')
      .select(
        'id, entry_date, quantity, amount, created_at, worker:workers(name, worker_code), work_code:work_codes(code, description)'
      )
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('payments')
      .select('id, payment_date, amount, note, created_at, worker:workers(name, worker_code)')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // Unlike activeWorkers/workCodes above, entries and attendance are never
  // served from a stale cache — activeWorkers is real (from cache or fresh),
  // but if either of these genuinely failed, combining that real worker
  // list with silently-empty entries/attendance would compute a wrong total
  // that still looks like a normal number (e.g. paying full weekly salary
  // to workers whose absences didn't load), not an obviously-degraded one.
  // Better to say the figure is unavailable than to show a plausible one
  // that's actually incorrect.
  const payrollUnavailable = Boolean(weekEntriesError || weekAttendanceError)

  // Mirrors finalize_weekly_slip()'s live formula, summed across every
  // active worker — a plain sum of work_entries would miss every
  // salary-only worker (they never log entries) and, before this fix, was
  // keyed off the wrong date field for backdated entries. Shares its
  // per-worker calculation with SlipView via @facto/payroll-core instead of
  // keeping its own copy, so the two can't silently drift out of sync
  // again the way this figure once did.
  const entriesByWorker = new Map<string, number>()
  for (const e of weekEntries ?? []) {
    entriesByWorker.set(e.worker_id, (entriesByWorker.get(e.worker_id) ?? 0) + Number(e.amount))
  }
  const attendanceByWorker = new Map<string, NonNullable<typeof weekAttendance>>()
  for (const a of weekAttendance ?? []) {
    const rows = attendanceByWorker.get(a.worker_id) ?? []
    rows.push(a)
    attendanceByWorker.set(a.worker_id, rows)
  }
  const weeklyPayroll = (activeWorkers ?? []).reduce((total, w) => {
    const salaryComponent = computeSalaryComponent({
      weeklySalary: w.weekly_salary,
      attendanceRows: attendanceByWorker.get(w.id) ?? [],
      weekStart,
      weekEnd,
      standardDaysPerWeek: org.standard_days_per_week,
      standardHoursPerDay: org.standard_hours_per_day,
      overtimeRateMultiplier: org.overtime_rate_multiplier,
    })
    const workAmount = computeWorkAmount({
      employmentType: w.employment_type,
      entriesAmount: entriesByWorker.get(w.id) ?? 0,
      salaryComponent,
    })
    return total + workAmount
  }, 0)
  const selectedWorker = (activeWorkers ?? []).find((w) => w.id === workerId)
  const formWorkers = selectedWorker ? [selectedWorker] : []

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Pick a worker to log today&apos;s work or payments and watch their weekly report update live.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-4 max-w-sm">
        <DashboardWorkerSelector workers={activeWorkers ?? []} workerId={workerId} />
      </div>

      {selectedWorker ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.5fr]">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-700">
              Log work &amp; payments — {workerLabel(selectedWorker)}
            </h2>
            <div className="mt-3 space-y-3">
              {selectedWorker.employment_type === 'salary' ? null : workCodes?.length ? (
                <EntryForm
                  key={selectedWorker.id}
                  organizationId={org.id}
                  today={today}
                  workers={formWorkers}
                  workCodes={workCodes}
                  dateFormat={org.date_format as DateFormat}
                />
              ) : (
                <p className="text-sm text-zinc-400">Add at least one active work code first.</p>
              )}
              <PaymentForm
                key={selectedWorker.id}
                organizationId={org.id}
                today={today}
                workers={formWorkers}
                dateFormat={org.date_format as DateFormat}
              />
            </div>

            <WeekActivity
              organizationId={org.id}
              workerId={selectedWorker.id}
              weekStart={weekStart}
              weekEnd={weekEnd}
              timezone={org.timezone}
              currency={org.currency}
              dateFormat={org.date_format as DateFormat}
              showDecimals={org.show_decimals}
              canDelete={membership.role === 'owner'}
            />
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <SlipView
              organizationId={org.id}
              orgName={org.name}
              workerId={selectedWorker.id}
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
              embedded
              heading="This week's report"
            />
          </section>
        </div>
      ) : (
        <p className="mt-6 rounded-md border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
          No worker selected yet.
        </p>
      )}

      <div className="mt-12 border-t border-zinc-200 pt-8">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-500">
            This week&apos;s payroll ({formatDate(weekStart, org.date_format as DateFormat)} to{' '}
            {formatDate(weekEnd, org.date_format as DateFormat)})
          </p>
          {payrollUnavailable ? (
            <p className="mt-1 text-sm text-zinc-400">Can&apos;t reach the server — figure unavailable.</p>
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {formatMoney(weeklyPayroll, org.currency, org.show_decimals)}
            </p>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Workers with outstanding advances</h2>
            {!outstandingWorkers?.length && (
              <p className="mt-2 text-sm text-zinc-400">No workers currently owe an advance.</p>
            )}
            <ul className="mt-2 divide-y divide-zinc-200">
              {outstandingWorkers?.map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{workerLabel(w)}</span>
                  <span className="font-medium text-red-700">
                    {formatMoney(w.advance_balance, org.currency, org.show_decimals)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-500">Recent entries</h2>
            {!recentEntries?.length && <p className="mt-2 text-sm text-zinc-400">No entries yet.</p>}
            <ul className="mt-2 divide-y divide-zinc-200">
              {recentEntries?.map((e) => {
                const worker = one<WorkerRef>(e.worker)
                const workCode = one<WorkCodeRef>(e.work_code)
                return (
                  <li key={e.id} className="py-2 text-sm">
                    <p>{worker ? workerLabel(worker) : '—'}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(e.entry_date, org.date_format as DateFormat)} ·{' '}
                      {formatTime(e.created_at, org.timezone)} · {workCode?.code} ({workCode?.description}) · qty{' '}
                      {e.quantity} = {formatMoney(e.amount, org.currency, org.show_decimals)}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-500">Recent payments</h2>
            {!recentPayments?.length && <p className="mt-2 text-sm text-zinc-400">No payments logged yet.</p>}
            <ul className="mt-2 divide-y divide-zinc-200">
              {recentPayments?.map((p) => {
                const worker = one<WorkerRef>(p.worker)
                return (
                  <li key={p.id} className="py-2 text-sm">
                    <p>{worker ? workerLabel(worker) : '—'}</p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(p.payment_date, org.date_format as DateFormat)} ·{' '}
                      {formatTime(p.created_at, org.timezone)} · paid{' '}
                      {formatMoney(p.amount, org.currency, org.show_decimals)}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

async function WeekActivity({
  organizationId,
  workerId,
  weekStart,
  weekEnd,
  timezone,
  currency,
  dateFormat,
  showDecimals,
  canDelete,
}: {
  organizationId: string
  workerId: string
  weekStart: string
  weekEnd: string
  timezone: string
  currency: string
  dateFormat: DateFormat
  showDecimals: boolean
  canDelete: boolean
}) {
  const supabase = await createClient()

  // Filtered by when they were LOGGED (created_at), not the business date
  // they're for — a backdated entry made today still belongs in today's
  // activity feed, even though its own date is from last month. (What
  // week that amount actually counts toward is a separate question,
  // handled by counted_week_start — see SlipView.tsx.)
  const rangeStart = `${weekStart}T00:00:00.000Z`
  const rangeEnd = `${addDays(weekEnd, 1)}T00:00:00.000Z`

  const [{ data: entries }, { data: payments }] = await Promise.all([
    supabase
      .from('work_entries')
      .select(
        'id, entry_date, quantity, rate_snapshot, amount, created_at, work_code:work_codes(code, description)'
      )
      .eq('organization_id', organizationId)
      .eq('worker_id', workerId)
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEnd)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, payment_date, amount, note, created_at')
      .eq('organization_id', organizationId)
      .eq('worker_id', workerId)
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEnd)
      .order('created_at', { ascending: false }),
  ])

  if (!entries?.length && !payments?.length) {
    return <p className="mt-4 text-sm text-zinc-400">Nothing logged this week yet.</p>
  }

  // Interleave entries and payments by the exact moment they were logged,
  // instead of showing every entry before every payment.
  type Row = { key: string; created_at: string; node: React.ReactNode }
  const entryRows: Row[] = (entries ?? []).map((e) => {
    const workCode = one<WorkCodeRef>(e.work_code)
    // Dated before this week started — logged today, but for a previous
    // week — flagged so it's obvious at a glance it's a backdated entry.
    const isPastWeek = e.entry_date < weekStart
    return {
      key: `e-${e.id}`,
      created_at: e.created_at,
      node: (
        <li
          key={`e-${e.id}`}
          className={`flex items-center justify-between py-2 text-sm ${
            isPastWeek ? 'rounded-md bg-amber-50 px-2 -mx-2' : ''
          }`}
        >
          <span className="text-zinc-600">
            <span className="text-xs text-zinc-400">
              {formatDate(e.entry_date, dateFormat)} · {formatTime(e.created_at, timezone)}
            </span>{' '}
            {isPastWeek && (
              <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                Previous week
              </span>
            )}{' '}
            {workCode?.code} · {e.quantity} × {formatMoney(e.rate_snapshot, currency, showDecimals)} ={' '}
            <span className="font-medium text-zinc-900">{formatMoney(e.amount, currency, showDecimals)}</span>
          </span>
          {canDelete && (
            <form action={deleteEntry}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="returnTo" value="/dashboard" />
              <button type="submit" className="text-xs text-red-600 underline hover:text-red-800">
                Delete
              </button>
            </form>
          )}
        </li>
      ),
    }
  })
  const paymentRows: Row[] = (payments ?? []).map((p) => {
    const isPastWeek = p.payment_date < weekStart
    return {
      key: `p-${p.id}`,
      created_at: p.created_at,
      node: (
        <li
          key={`p-${p.id}`}
          className={`flex items-center justify-between py-2 text-sm ${
            isPastWeek ? 'rounded-md bg-amber-50 px-2 -mx-2' : ''
          }`}
        >
          <span className="text-zinc-600">
            <span className="text-xs text-zinc-400">
              {formatDate(p.payment_date, dateFormat)} · {formatTime(p.created_at, timezone)}
            </span>{' '}
            {isPastWeek && (
              <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                Previous week
              </span>
            )}{' '}
            Paid <span className="font-medium text-zinc-900">{formatMoney(p.amount, currency, showDecimals)}</span>
            {p.note ? ` · ${p.note}` : ''}
          </span>
          {canDelete && (
            <form action={deletePayment}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="returnTo" value="/dashboard" />
              <button type="submit" className="text-xs text-red-600 underline hover:text-red-800">
                Delete
              </button>
            </form>
          )}
        </li>
      ),
    }
  })

  const rows = [...entryRows, ...paymentRows].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="mt-4 space-y-1">
      <h3 className="text-xs font-medium text-zinc-500">This week&apos;s activity</h3>
      <ul className="divide-y divide-zinc-100">{rows.map((r) => r.node)}</ul>
    </div>
  )
}
