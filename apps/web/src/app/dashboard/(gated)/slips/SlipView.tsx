import {
  addDays,
  dayAbbr,
  daySpan,
  formatDate,
  nextAnchorOnOrAfter,
  resolveWeekBounds,
  today as todayStr,
  type DateFormat,
  type WeekScheme,
  type WeekStartDay,
} from '@/lib/dates'
import { one } from '@/lib/one'
import { formatMoney, formatNumber, formatSigned } from '@/lib/format'
import { computeSalaryComponent, computeWorkAmount } from '@facto/payroll-core'
import { createClient } from '@/lib/supabase/server'
import { reopenSlip } from './actions'
import { ConfirmButton } from './ConfirmButton'
import { PrintButton } from './PrintButton'
import { FinalizeSection } from './FinalizeSection'
import { AttendanceGrid } from './AttendanceGrid'

type LineRow = {
  date: string
  description: string
  quantity: number | null
  rate: number | null
  amount: number | null
  paidAmount: number | null
  // Set only for a late entry/payment: dated within this week but logged
  // after this week was finalized, so its amount actually counts toward
  // a later week instead — shown here for visibility only, not summed.
  note?: string
}

export async function SlipView({
  organizationId,
  orgName,
  workerId,
  weekStart,
  weekStartDay,
  previousWeekStartDay,
  transitionDate,
  canFinalize,
  viewerRole,
  currency,
  dateFormat,
  showDecimals,
  standardDaysPerWeek,
  standardHoursPerDay,
  overtimeRateMultiplier,
  embedded = false,
  heading,
}: {
  organizationId: string
  orgName: string
  workerId: string
  weekStart: string
  weekStartDay: WeekStartDay
  previousWeekStartDay: WeekStartDay | null
  transitionDate: string | null
  canFinalize: boolean
  viewerRole: 'owner' | 'admin' | 'staff'
  currency: string
  dateFormat: DateFormat
  showDecimals: boolean
  standardDaysPerWeek: number
  standardHoursPerDay: number
  overtimeRateMultiplier: number
  embedded?: boolean
  heading?: string
}) {
  const scheme: WeekScheme = { weekStartDay, previousWeekStartDay, transitionDate }
  const supabase = await createClient()

  const { data: worker } = await supabase
    .from('workers')
    .select(
      'id, worker_code, name, father_name, contact_no, designation, address, photo_url, advance_balance, employment_type, weekly_salary'
    )
    .eq('id', workerId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!worker) {
    return <p className="mt-8 text-sm text-red-600 print:hidden">Worker not found.</p>
  }

  let photoSignedUrl: string | null = null
  if (worker.photo_url) {
    const { data } = await supabase.storage.from('worker-photos').createSignedUrl(worker.photo_url, 3600)
    photoSignedUrl = data?.signedUrl ?? null
  }

  const { data: slip } = await supabase
    .from('weekly_slips')
    .select('id, status, week_end, work_amount, paid_amount, advance_delta, payable_balance, final_amount')
    .eq('organization_id', organizationId)
    .eq('worker_id', workerId)
    .eq('week_start', weekStart)
    .maybeSingle()

  // An existing slip's own stored week_end is authoritative (it may be a
  // short transition week, already fixed at finalize/first-save time) —
  // only a week with no row yet needs its bounds computed fresh, aware of
  // any pending Week Start Day transition (see lib/dates.ts).
  const weekEnd = slip?.week_end ?? resolveWeekBounds(weekStart, scheme).weekEnd

  // Entries/payments COUNTED toward this week's totals — keyed by
  // counted_week_start, not their own date, so a backdated entry logged
  // after its real week was finalized (and therefore reassigned to a
  // later week) is summed where it actually counts, not where it's dated.
  const { data: entries } = await supabase
    .from('work_entries')
    .select('id, entry_date, quantity, rate_snapshot, amount, work_code:work_codes(code, description)')
    .eq('organization_id', organizationId)
    .eq('worker_id', workerId)
    .eq('counted_week_start', weekStart)
    .order('entry_date')

  const { data: payments } = await supabase
    .from('payments')
    .select('id, payment_date, amount, note')
    .eq('organization_id', organizationId)
    .eq('worker_id', workerId)
    .eq('counted_week_start', weekStart)
    .order('payment_date')

  // Attendance has no counted_week_start (see the migration for why) — it's
  // always looked up by the plain calendar range of the week being viewed.
  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('attendance_date, status, overtime_hours, overtime_wage, holiday_wage')
    .eq('organization_id', organizationId)
    .eq('worker_id', workerId)
    .gte('attendance_date', weekStart)
    .lte('attendance_date', weekEnd)

  const isFinalized = slip?.status === 'finalized'

  // Late entries/payments: dated within this week's calendar range, but
  // logged after this week was finalized — only ever exist for a
  // finalized week (a still-draft week can't have anything "shifted
  // away" from it). Shown with a note, excluded from all totals.
  const [{ data: lateEntries }, { data: latePayments }] = isFinalized
    ? await Promise.all([
        supabase
          .from('work_entries')
          .select(
            'id, entry_date, quantity, rate_snapshot, amount, counted_week_start, work_code:work_codes(code, description)'
          )
          .eq('organization_id', organizationId)
          .eq('worker_id', workerId)
          .gte('entry_date', weekStart)
          .lte('entry_date', weekEnd)
          .neq('counted_week_start', weekStart)
          .order('entry_date'),
        supabase
          .from('payments')
          .select('id, payment_date, amount, counted_week_start')
          .eq('organization_id', organizationId)
          .eq('worker_id', workerId)
          .gte('payment_date', weekStart)
          .lte('payment_date', weekEnd)
          .neq('counted_week_start', weekStart)
          .order('payment_date'),
      ])
    : [{ data: [] }, { data: [] }]

  // What counts as "work" depends on how this worker is paid: contract
  // workers are paid for entries logged, salary/hybrid workers are paid an
  // attendance-driven salary component. Shared with the Dashboard's
  // org-wide payroll total via @facto/payroll-core, so both stay in lockstep
  // with finalize_weekly_slip() instead of drifting as separate copies —
  // see the attendance_holiday_and_daily_edit and
  // week_scheme_transition_holiday_fix migrations for the SQL source of
  // truth this mirrors.
  const liveEntriesAmount = (entries ?? []).reduce((sum, e) => sum + Number(e.amount), 0)
  const weeklySalary = worker.weekly_salary != null ? Number(worker.weekly_salary) : 0
  const salaryComponent = computeSalaryComponent({
    weeklySalary: worker.weekly_salary,
    attendanceRows: attendanceRows ?? [],
    weekStart,
    weekEnd,
    standardDaysPerWeek,
    standardHoursPerDay,
    overtimeRateMultiplier,
  })
  const liveWorkAmount = computeWorkAmount({
    employmentType: worker.employment_type,
    entriesAmount: liveEntriesAmount,
    salaryComponent,
  })
  const livePaidAmount = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

  const workAmount = isFinalized ? Number(slip!.work_amount) : liveWorkAmount
  const paidAmount = isFinalized ? Number(slip!.paid_amount) : livePaidAmount
  // amount still owed to the worker after this week's daily/incremental payments
  const payable = workAmount - paidAmount
  const currentAdvanceBalance = Number(worker.advance_balance)

  // only meaningful once finalized — the admin-entered settlement amount
  const finalAmount = isFinalized ? Number(slip!.final_amount) : null
  // positive = overpay (advance grows), negative = shortfall (advance shrinks)
  const delta = isFinalized ? Number(slip!.advance_delta) : null

  const paymentsByDate = new Map<string, number>()
  for (const p of payments ?? []) {
    paymentsByDate.set(p.payment_date, (paymentsByDate.get(p.payment_date) ?? 0) + Number(p.amount))
  }

  // These are otherwise ordinary rows counted toward this week — but their
  // own date can still fall outside [weekStart, weekEnd] when it was
  // redirected here from an earlier, already-finalized week (see
  // resolveCountedWeekStart). Flagging that here — on the destination side —
  // matches the note the ORIGIN week already shows for the same entry, so
  // it's clear from either side why it's counted where it is.
  function redirectNote(dateStr: string): string | undefined {
    if (dateStr >= weekStart && dateStr <= weekEnd) return undefined
    return 'Dated in an earlier week that was already finalized when this was logged — counted here instead.'
  }

  const shownPaidDates = new Set<string>()
  const rows: LineRow[] = (entries ?? []).map((e) => {
    const workCode = one<{ code: string; description: string }>(e.work_code)
    const alreadyShown = shownPaidDates.has(e.entry_date)
    const paidForDate = paymentsByDate.get(e.entry_date) ?? null
    if (paidForDate !== null && !alreadyShown) shownPaidDates.add(e.entry_date)
    return {
      date: e.entry_date,
      description: workCode ? `${workCode.code} — ${workCode.description}` : '—',
      quantity: Number(e.quantity),
      rate: Number(e.rate_snapshot),
      amount: Number(e.amount),
      paidAmount: alreadyShown ? null : paidForDate,
      note: redirectNote(e.entry_date),
    }
  })

  for (const [date, total] of paymentsByDate) {
    if (!(entries ?? []).some((e) => e.entry_date === date)) {
      rows.push({
        date,
        description: '—',
        quantity: null,
        rate: null,
        amount: null,
        paidAmount: total,
        note: redirectNote(date),
      })
    }
  }

  for (const e of lateEntries ?? []) {
    const workCode = one<{ code: string; description: string }>(e.work_code)
    rows.push({
      date: e.entry_date,
      description: workCode ? `${workCode.code} — ${workCode.description}` : '—',
      quantity: Number(e.quantity),
      rate: Number(e.rate_snapshot),
      amount: Number(e.amount),
      paidAmount: null,
      note: `Logged after this week was finalized — counted in the week of ${formatDate(e.counted_week_start, dateFormat)} instead.`,
    })
  }
  for (const p of latePayments ?? []) {
    rows.push({
      date: p.payment_date,
      description: '—',
      quantity: null,
      rate: null,
      amount: null,
      paidAmount: Number(p.amount),
      note: `Payment logged after this week was finalized — counted in the week of ${formatDate(p.counted_week_start, dateFormat)} instead.`,
    })
  }

  rows.sort((a, b) => a.date.localeCompare(b.date))

  // Finalize/reopen should land back on wherever they were submitted from —
  // the Dashboard's embedded view has no weekStart param of its own (it only
  // shows the current week), so redirecting it to /dashboard/slips would
  // silently switch tabs on the user.
  const returnTo = embedded ? '/dashboard' : '/dashboard/slips'

  // A week around a Week Start Day change is one of two kinds, each needing
  // its own small notice so the shorter-than-usual span isn't a silent
  // mystery later: the old week — the one that was actually running when
  // the switch happened — cut short right before the new scheme's first
  // clean anchor day, or that first full week itself. See lib/dates.ts for
  // how these boundaries are derived; nextAnchorOnOrAfter is what lets the
  // new scheme start the very same day when the switch date already
  // happens to be its anchor day, instead of always waiting a week.
  //
  // isTruncatedOldWeek deliberately checks the week's OWN span (< 7 days)
  // rather than matching it against the org's CURRENT transition record —
  // a week only ever gets cut short by a transition, so a short span is
  // sufficient on its own, and staying self-contained like this means an
  // already-finalized short week keeps displaying correctly (full stored
  // weekEnd, no day hidden) even after a LATER transition has since
  // overwritten the single most-recent transition record it was originally
  // truncated by. Matching against the current record only would silently
  // go stale in that case — a real bug an earlier version of this check had.
  const isTruncatedOldWeek = daySpan(weekStart, weekEnd) < 7
  const isFirstCleanWeek =
    transitionDate != null && weekStart === nextAnchorOnOrAfter(transitionDate, weekStartDay)

  // Displayed range ends at the last WORKING day — normally that's the day
  // before weekEnd, since weekEnd is always the day off. A truncated old
  // week is the one exception: it's cut short by the scheme change itself,
  // before ever reaching its real day off, so every day in it — including
  // the very last one — is still a genuine working day; nothing to hide.
  const displayWeekEnd = isTruncatedOldWeek ? weekEnd : addDays(weekEnd, -1)
  const transitionNotice = isTruncatedOldWeek
    ? `Cut short by a Week Start Day change on ${formatDate(transitionDate!, dateFormat)}.`
    : isFirstCleanWeek
      ? `First full week after the Week Start Day change on ${formatDate(transitionDate!, dateFormat)}.`
      : null

  const weekTypeLabel = dayAbbr(weekStart) === 'Sat' ? 'Sat-Thu' : 'Mon-Sat'

  return (
    <div className={embedded ? '' : 'mt-8'}>
      <div className={`print:hidden ${embedded ? 'mt-3' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <div>{heading && <h2 className="text-sm font-semibold text-zinc-700">{heading}</h2>}</div>
          <div className="flex shrink-0 gap-3">
            <PrintButton />
            {canFinalize && isFinalized && slip && (
              <form action={reopenSlip}>
                <input type="hidden" name="slipId" value={slip.id} />
                <input type="hidden" name="workerId" value={workerId} />
                <input type="hidden" name="weekStart" value={weekStart} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmButton
                  confirmText="Reopen this week? This reverses the advance balance change and unlocks entries and payments for editing."
                  className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  Reopen week
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {/* The Dashboard's embedded view only ever shows the current week
              (there's no week navigation here) — a plain badge is enough,
              unlike the Weekly Slips tab's Current Week button, which needs
              to say whether the week you've navigated to happens to match. */}
          {embedded && (
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Current week
            </span>
          )}
          <p className="text-sm text-zinc-500">
            Week: {formatDate(weekStart, dateFormat)} to {formatDate(displayWeekEnd, dateFormat)} (
            {weekTypeLabel}) ·{' '}
            <span className={isFinalized ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>
              {isFinalized ? 'Finalized' : 'Draft'}
            </span>
          </p>
        </div>
      </div>

      <div
        id="printable-slip"
        className={
          embedded
            ? 'mt-3'
            : 'mt-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none'
        }
      >
        <div className="text-center">
          <h2 className="text-lg font-semibold">{orgName}</h2>
          <p className="text-sm text-zinc-500">Worker Salary Slip</p>
          <p className="text-xs text-zinc-400">
            {formatDate(weekStart, dateFormat)} to {formatDate(displayWeekEnd, dateFormat)} ({weekTypeLabel})
          </p>
          {/* Screen already shows this in the print:hidden status bar above
              — only needs a print-specific copy so it isn't lost on paper. */}
          <p
            className={`hidden text-xs font-medium print:block ${isFinalized ? 'text-emerald-700' : 'text-amber-700'}`}
          >
            {isFinalized ? 'Finalized' : 'Draft'}
          </p>
          {transitionNotice && <p className="mt-1 text-[11px] text-sky-700">{transitionNotice}</p>}
        </div>

        <div className="mt-6 flex flex-wrap gap-6">
          {photoSignedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoSignedUrl} alt={worker.name} className="h-24 w-24 rounded-md object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-400">
              No photo
            </div>
          )}
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <InfoRow label="Worker ID" value={worker.worker_code ?? '—'} />
            <InfoRow label="Name" value={worker.name} />
            <InfoRow label="Father Name" value={worker.father_name ?? '—'} />
            <InfoRow label="Contact No" value={worker.contact_no ?? '—'} />
            <InfoRow label="Designation" value={worker.designation ?? '—'} />
            <InfoRow label="Address" value={worker.address ?? '—'} />
            <InfoRow label="Total Advance" value={formatMoney(worker.advance_balance, currency, showDecimals)} />
          </dl>
        </div>

        {worker.employment_type !== 'contract' && (
          <AttendanceGrid
            key={`${workerId}-${weekStart}`}
            organizationId={organizationId}
            workerId={workerId}
            weekStart={weekStart}
            weekEnd={weekEnd}
            dateFormat={dateFormat}
            existingRows={attendanceRows ?? []}
            weeklySalary={weeklySalary}
            standardDaysPerWeek={standardDaysPerWeek}
            standardHoursPerDay={standardHoursPerDay}
            overtimeRateMultiplier={overtimeRateMultiplier}
            currency={currency}
            showDecimals={showDecimals}
            weekFinalized={isFinalized}
            today={todayStr()}
            canEditPastDays={viewerRole === 'owner'}
          />
        )}

        <div className="mt-6 overflow-x-auto print:overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-left">
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Day</th>
                <th className="py-2 pr-2">Description</th>
                <th className="py-2 px-2 text-right">Quantity</th>
                <th className="py-2 px-2 text-right">Rate</th>
                <th className="py-2 px-2 text-right">Amount</th>
                <th className="py-2 pl-2 text-right">Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-zinc-400">
                    No entries or payments this week.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className={`border-b border-zinc-100 ${r.note ? 'bg-amber-50/60' : ''}`}>
                  <td className="py-2 pr-2 whitespace-nowrap">{formatDate(r.date, dateFormat)}</td>
                  <td className="py-2 pr-2">{dayAbbr(r.date)}</td>
                  <td className="py-2 pr-2">
                    {r.description}
                    {r.note && <span className="mt-0.5 block text-[11px] italic text-amber-700">Note: {r.note}</span>}
                  </td>
                  <td className="py-2 px-2 text-right">{r.quantity ?? '—'}</td>
                  <td className="py-2 px-2 text-right whitespace-nowrap">
                    {r.rate !== null ? formatNumber(r.rate, showDecimals) : '—'}
                  </td>
                  <td className="py-2 px-2 text-right whitespace-nowrap">
                    {r.amount !== null ? formatNumber(r.amount, showDecimals) : '—'}
                  </td>
                  <td className="py-2 pl-2 text-right whitespace-nowrap">
                    {r.paidAmount !== null ? formatNumber(r.paidAmount, showDecimals) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-300 font-semibold">
                <td className="py-2" colSpan={5}>
                  Total
                </td>
                <td className="py-2 px-2 text-right whitespace-nowrap">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-[10px] font-normal text-zinc-500">Total Work</span>
                    <span>{formatMoney(workAmount, currency, showDecimals)}</span>
                  </div>
                </td>
                <td className="py-2 pl-2 text-right whitespace-nowrap">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-[10px] font-normal text-zinc-500">Paid Amount</span>
                    <span>{formatMoney(paidAmount, currency, showDecimals)}</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 ml-auto w-full max-w-xs space-y-1 text-sm">
          <SummaryRow label="Payable" value={payable} bold currency={currency} showDecimals={showDecimals} />

          {isFinalized && delta !== null && finalAmount !== null ? (
            <>
              {delta < 0 && (
                <SummaryRow label="Advance -" value={delta} signed currency={currency} showDecimals={showDecimals} />
              )}
              {delta > 0 && (
                <SummaryRow label="Advance +" value={delta} signed currency={currency} showDecimals={showDecimals} />
              )}
              <SummaryRow label="Final Paid" value={finalAmount} currency={currency} showDecimals={showDecimals} />
              <SummaryRow
                label="Total Advance"
                value={currentAdvanceBalance}
                bold
                currency={currency}
                showDecimals={showDecimals}
              />
            </>
          ) : !isFinalized ? (
            <>
              {canFinalize && (
                <div className="pt-2 print:hidden">
                  <FinalizeSection
                    organizationId={organizationId}
                    workerId={workerId}
                    weekStart={weekStart}
                    weekEnd={weekEnd}
                    returnTo={returnTo}
                    payable={payable}
                    currentAdvanceBalance={currentAdvanceBalance}
                    currency={currency}
                    showDecimals={showDecimals}
                  />
                </div>
              )}
              {/* On screen, an admin/owner sees the form above instead; a
                  printed page always needs this line since the form itself
                  never prints. */}
              <p className={`pt-2 text-xs text-zinc-400 ${canFinalize ? 'hidden print:block' : ''}`}>
                Pending finalization by an admin or owner.
              </p>
            </>
          ) : null}
        </div>

        <p className="mt-6 text-xs text-zinc-400">
          If Final Amount is more than Payable, extra amount will automatically be added to Total Advance.
        </p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  )
}

function SummaryRow({
  label,
  value,
  bold,
  signed,
  currency,
  showDecimals,
}: {
  label: string
  value: number
  bold?: boolean
  signed?: boolean
  currency: string
  showDecimals: boolean
}) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span>{signed ? formatSigned(value, currency, showDecimals) : formatMoney(value, currency, showDecimals)}</span>
    </div>
  )
}
