import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { addDays, currentWeekStart, today as todayStr } from '@/lib/dates'
import { one } from '@/lib/one'
import { EntryForm } from './entries/EntryForm'
import { PaymentForm } from './entries/PaymentForm'
import { deleteEntry, deletePayment } from './entries/actions'
import { SlipView } from './slips/SlipView'
import { DashboardWorkerSelector } from './DashboardWorkerSelector'

type WorkerRef = { name: string; worker_code: string }
type WorkCodeRef = { code: string; description: string }

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workerId?: string; error?: string }>
}) {
  const { workerId, error } = await searchParams
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')

  const org = membership.organization
  const canFinalize = membership.role === 'owner' || membership.role === 'admin'
  const weekStart = currentWeekStart(org.week_start_day)
  const weekEnd = addDays(weekStart, 6)
  const today = todayStr()

  const supabase = await createClient()

  const [
    { data: activeWorkers },
    { data: workCodes },
    { data: weekEntries },
    { data: outstandingWorkers },
    { data: recentEntries },
  ] = await Promise.all([
    supabase
      .from('workers')
      .select('id, worker_code, name, is_active')
      .eq('organization_id', org.id)
      .eq('is_active', true)
      .order('worker_code'),
    supabase
      .from('work_codes')
      .select('id, code, description, rate')
      .eq('organization_id', org.id)
      .eq('is_active', true)
      .order('code'),
    supabase
      .from('work_entries')
      .select('amount')
      .eq('organization_id', org.id)
      .gte('entry_date', weekStart)
      .lte('entry_date', weekEnd),
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
        'id, entry_date, quantity, amount, worker:workers(name, worker_code), work_code:work_codes(code, description)'
      )
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const weeklyPayroll = (weekEntries ?? []).reduce((sum, e) => sum + Number(e.amount), 0)
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
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-700">
              Log work &amp; payments — {selectedWorker.worker_code} · {selectedWorker.name}
            </h2>
            <div className="mt-3 space-y-3">
              {workCodes?.length ? (
                <EntryForm organizationId={org.id} today={today} workers={formWorkers} workCodes={workCodes} />
              ) : (
                <p className="text-sm text-zinc-400">Add at least one active work code first.</p>
              )}
              <PaymentForm organizationId={org.id} today={today} workers={formWorkers} />
            </div>

            <TodayActivity organizationId={org.id} workerId={selectedWorker.id} today={today} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-zinc-700">This week&apos;s report</h2>
            <SlipView
              organizationId={org.id}
              orgName={org.name}
              workerId={selectedWorker.id}
              weekStart={weekStart}
              canFinalize={canFinalize}
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
            This week&apos;s payroll ({weekStart} to {weekEnd})
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{weeklyPayroll.toFixed(2)}</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Workers with outstanding advances</h2>
            {!outstandingWorkers?.length && (
              <p className="mt-2 text-sm text-zinc-400">No workers currently owe an advance.</p>
            )}
            <ul className="mt-2 divide-y divide-zinc-200">
              {outstandingWorkers?.map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {w.worker_code} — {w.name}
                  </span>
                  <span className="font-medium text-red-700">{Number(w.advance_balance).toFixed(2)}</span>
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
                    <p>
                      {worker?.worker_code} — {worker?.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {e.entry_date} · {workCode?.code} ({workCode?.description}) · qty {e.quantity} ={' '}
                      {Number(e.amount).toFixed(2)}
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

async function TodayActivity({
  organizationId,
  workerId,
  today,
}: {
  organizationId: string
  workerId: string
  today: string
}) {
  const supabase = await createClient()

  const [{ data: entries }, { data: payments }] = await Promise.all([
    supabase
      .from('work_entries')
      .select('id, quantity, rate_snapshot, amount, work_code:work_codes(code, description)')
      .eq('organization_id', organizationId)
      .eq('worker_id', workerId)
      .eq('entry_date', today)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, amount, note')
      .eq('organization_id', organizationId)
      .eq('worker_id', workerId)
      .eq('payment_date', today)
      .order('created_at', { ascending: false }),
  ])

  if (!entries?.length && !payments?.length) {
    return <p className="mt-4 text-sm text-zinc-400">Nothing logged for today yet.</p>
  }

  return (
    <div className="mt-4 space-y-1">
      <h3 className="text-xs font-medium text-zinc-500">Today</h3>
      <ul className="divide-y divide-zinc-100">
        {entries?.map((e) => {
          const workCode = one<WorkCodeRef>(e.work_code)
          return (
            <li key={e.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-zinc-600">
                {workCode?.code} · {e.quantity} × {Number(e.rate_snapshot).toFixed(2)} ={' '}
                <span className="font-medium text-zinc-900">{Number(e.amount).toFixed(2)}</span>
              </span>
              <form action={deleteEntry}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="returnTo" value="/dashboard" />
                <button type="submit" className="text-xs text-red-600 underline hover:text-red-800">
                  Delete
                </button>
              </form>
            </li>
          )
        })}
        {payments?.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-zinc-600">
              Paid <span className="font-medium text-zinc-900">{Number(p.amount).toFixed(2)}</span>
              {p.note ? ` · ${p.note}` : ''}
            </span>
            <form action={deletePayment}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="returnTo" value="/dashboard" />
              <button type="submit" className="text-xs text-red-600 underline hover:text-red-800">
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  )
}
