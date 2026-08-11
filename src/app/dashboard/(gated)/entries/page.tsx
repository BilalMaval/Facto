import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { one } from '@/lib/one'
import { formatDate, formatTime, today as todayStr, type DateFormat } from '@/lib/dates'
import { periodRange, periodLabel, type Period } from '@/lib/period'
import { formatMoney, workerLabel } from '@/lib/format'
import { EntryForm } from './EntryForm'
import { PaymentForm } from './PaymentForm'
import { deleteEntry, deletePayment } from './actions'
import { PeriodFilterBar } from '../../_components/PeriodFilterBar'

type WorkerRef = { name: string; worker_code: string | null }
type WorkCodeRef = { code: string; description: string }

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    period?: string
    date?: string
    startDate?: string
    endDate?: string
    workerId?: string
  }>
}) {
  const {
    error,
    period: periodParam,
    date: dateParam,
    startDate: startDateParam,
    endDate: endDateParam,
    workerId: filterWorkerId,
  } = await searchParams
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')

  const org = membership.organization
  const today = todayStr()
  const canDelete = membership.role === 'owner'

  const period: Period = (['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).includes(
    periodParam as Period
  )
    ? (periodParam as Period)
    : 'daily'
  const date = dateParam || today
  const startDate = startDateParam || date
  const endDate = endDateParam || startDate
  const range = periodRange(period, date, startDate, endDate, org.week_start_day)

  const supabase = await createClient()

  const [{ data: allWorkers }, { data: workCodes }] = await Promise.all([
    supabase
      .from('workers')
      .select('id, worker_code, name, is_active')
      .eq('organization_id', org.id)
      .order('worker_code'),
    supabase
      .from('work_codes')
      .select('id, code, description, rate')
      .eq('organization_id', org.id)
      .eq('is_active', true)
      .order('code'),
  ])

  const activeWorkers = (allWorkers ?? []).filter((w) => w.is_active)

  let entriesQuery = supabase
    .from('work_entries')
    .select(
      'id, entry_date, quantity, rate_snapshot, amount, created_at, created_by, worker:workers(name, worker_code), work_code:work_codes(code, description)'
    )
    .eq('organization_id', org.id)
    .gte('entry_date', range.start)
    .lte('entry_date', range.end)
    .order('entry_date', { ascending: false })
  if (filterWorkerId) entriesQuery = entriesQuery.eq('worker_id', filterWorkerId)

  let paymentsQuery = supabase
    .from('payments')
    .select('id, payment_date, amount, note, created_at, created_by, worker:workers(name, worker_code)')
    .eq('organization_id', org.id)
    .gte('payment_date', range.start)
    .lte('payment_date', range.end)
    .order('payment_date', { ascending: false })
  if (filterWorkerId) paymentsQuery = paymentsQuery.eq('worker_id', filterWorkerId)

  const [{ data: entries }, { data: payments }] = await Promise.all([entriesQuery, paymentsQuery])

  const rangeLabel = periodLabel(period, range)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Daily entry</h1>
      <p className="mt-1 text-sm text-zinc-500">Log today&apos;s output and payments for {org.name}.</p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!activeWorkers.length || !workCodes?.length ? (
        <p className="mt-6 rounded-md border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
          {!activeWorkers.length && 'Add at least one active worker. '}
          {!workCodes?.length && 'Add at least one active work code. '}
          Then come back here to log entries.
        </p>
      ) : (
        <div className="mt-6">
          <EntryForm
            organizationId={org.id}
            today={today}
            workers={activeWorkers}
            workCodes={workCodes}
            dateFormat={org.date_format as DateFormat}
          />
        </div>
      )}

      {activeWorkers.length ? (
        <PaymentForm
          organizationId={org.id}
          today={today}
          workers={activeWorkers}
          dateFormat={org.date_format as DateFormat}
        />
      ) : null}

      <div className="mt-10">
        <h2 className="text-sm font-medium text-zinc-500">Find entries &amp; payments</h2>
        <div className="mt-2">
          <PeriodFilterBar
            basePath="/dashboard/entries"
            workers={allWorkers ?? []}
            period={period}
            date={date}
            startDate={startDate}
            endDate={endDate}
            workerId={filterWorkerId ?? ''}
            dateFormat={org.date_format as DateFormat}
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Entries ({rangeLabel})</h2>
        {!entries?.length && <p className="mt-2 text-sm text-zinc-400">No entries in this period.</p>}
        <ul className="mt-2 divide-y divide-zinc-200">
          {entries?.map((e) => {
            const worker = one<WorkerRef>(e.worker)
            const workCode = one<WorkCodeRef>(e.work_code)
            return (
              <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <span className="text-zinc-400">
                    {formatDate(e.entry_date, org.date_format as DateFormat)} ·{' '}
                    {formatTime(e.created_at, org.timezone)}
                  </span>{' '}
                  <span className="font-medium">{worker ? workerLabel(worker) : '—'}</span>{' '}
                  <span className="text-zinc-500">
                    · {workCode?.code} ({workCode?.description}) · {e.quantity} ×{' '}
                    {formatMoney(e.rate_snapshot, org.currency, org.show_decimals)} ={' '}
                    <span className="font-medium text-zinc-900">
                      {formatMoney(e.amount, org.currency, org.show_decimals)}
                    </span>
                  </span>
                </div>
                {canDelete && (
                  <form action={deleteEntry}>
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="text-red-600 underline hover:text-red-800">
                      Delete
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Payments ({rangeLabel})</h2>
        {!payments?.length && <p className="mt-2 text-sm text-zinc-400">No payments logged in this period.</p>}
        <ul className="mt-2 divide-y divide-zinc-200">
          {payments?.map((p) => {
            const worker = one<WorkerRef>(p.worker)
            return (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <span className="text-zinc-400">
                    {formatDate(p.payment_date, org.date_format as DateFormat)} ·{' '}
                    {formatTime(p.created_at, org.timezone)}
                  </span>{' '}
                  <span className="font-medium">{worker ? workerLabel(worker) : '—'}</span>{' '}
                  <span className="text-zinc-500">
                    · paid{' '}
                    <span className="font-medium text-zinc-900">
                      {formatMoney(p.amount, org.currency, org.show_decimals)}
                    </span>
                    {p.note ? ` · ${p.note}` : ''}
                  </span>
                </div>
                {canDelete && (
                  <form action={deletePayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-red-600 underline hover:text-red-800">
                      Delete
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
