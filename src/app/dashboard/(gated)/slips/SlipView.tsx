import { addDays } from '@/lib/dates'
import { one } from '@/lib/one'
import { formatSigned } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { reopenSlip } from './actions'
import { ConfirmButton } from './ConfirmButton'
import { PrintButton } from './PrintButton'
import { FinalizeSection } from './FinalizeSection'

type LineRow = {
  date: string
  description: string
  quantity: number | null
  rate: number | null
  amount: number | null
  paidAmount: number | null
}

export async function SlipView({
  organizationId,
  orgName,
  workerId,
  weekStart,
  canFinalize,
}: {
  organizationId: string
  orgName: string
  workerId: string
  weekStart: string
  canFinalize: boolean
}) {
  const weekEnd = addDays(weekStart, 6)
  const supabase = await createClient()

  const { data: worker } = await supabase
    .from('workers')
    .select('id, worker_code, name, father_name, contact_no, designation, address, photo_url, advance_balance')
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
    .select('id, status, work_amount, paid_amount, advance_delta, payable_balance, final_amount')
    .eq('organization_id', organizationId)
    .eq('worker_id', workerId)
    .eq('week_start', weekStart)
    .maybeSingle()

  const { data: entries } = await supabase
    .from('work_entries')
    .select('id, entry_date, quantity, rate_snapshot, amount, work_code:work_codes(code, description)')
    .eq('organization_id', organizationId)
    .eq('worker_id', workerId)
    .gte('entry_date', weekStart)
    .lte('entry_date', weekEnd)
    .order('entry_date')

  const { data: payments } = await supabase
    .from('payments')
    .select('id, payment_date, amount, note')
    .eq('organization_id', organizationId)
    .eq('worker_id', workerId)
    .gte('payment_date', weekStart)
    .lte('payment_date', weekEnd)
    .order('payment_date')

  const isFinalized = slip?.status === 'finalized'

  const liveWorkAmount = (entries ?? []).reduce((sum, e) => sum + Number(e.amount), 0)
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
  const defaultFinalAmount = slip?.final_amount != null ? Number(slip.final_amount) : payable

  const paymentsByDate = new Map<string, number>()
  for (const p of payments ?? []) {
    paymentsByDate.set(p.payment_date, (paymentsByDate.get(p.payment_date) ?? 0) + Number(p.amount))
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
    }
  })

  for (const [date, total] of paymentsByDate) {
    if (!(entries ?? []).some((e) => e.entry_date === date)) {
      rows.push({ date, description: '—', quantity: null, rate: null, amount: null, paidAmount: total })
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-zinc-500">
          Week: {weekStart} to {weekEnd} ·{' '}
          <span className={isFinalized ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>
            {isFinalized ? 'Finalized' : 'Draft'}
          </span>
        </p>
        <div className="flex gap-3">
          <PrintButton />
          {canFinalize && isFinalized && slip && (
            <form action={reopenSlip}>
              <input type="hidden" name="slipId" value={slip.id} />
              <input type="hidden" name="workerId" value={workerId} />
              <input type="hidden" name="weekStart" value={weekStart} />
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

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="text-center">
          <h2 className="text-lg font-semibold">{orgName}</h2>
          <p className="text-sm text-zinc-500">Worker Salary Slip</p>
          <p className="text-xs text-zinc-400">
            {weekStart} to {weekEnd}
          </p>
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
            <InfoRow label="Worker ID" value={worker.worker_code} />
            <InfoRow label="Name" value={worker.name} />
            <InfoRow label="Father Name" value={worker.father_name ?? '—'} />
            <InfoRow label="Contact No" value={worker.contact_no ?? '—'} />
            <InfoRow label="Designation" value={worker.designation ?? '—'} />
            <InfoRow label="Address" value={worker.address ?? '—'} />
            <InfoRow label="Total Advance" value={Number(worker.advance_balance).toFixed(2)} />
          </dl>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left">
              <th className="py-2">Date</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Quantity</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2 text-right">Paid Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-zinc-400">
                  No entries or payments this week.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="py-2">{r.date}</td>
                <td className="py-2">{r.description}</td>
                <td className="py-2 text-right">{r.quantity ?? '—'}</td>
                <td className="py-2 text-right">{r.rate !== null ? r.rate.toFixed(2) : '—'}</td>
                <td className="py-2 text-right">{r.amount !== null ? r.amount.toFixed(2) : '—'}</td>
                <td className="py-2 text-right">{r.paidAmount !== null ? r.paidAmount.toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-300 font-semibold">
              <td className="py-2" colSpan={4}>
                Total
              </td>
              <td className="py-2 text-right">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-[10px] font-normal text-zinc-500">Total Work</span>
                  <span>{workAmount.toFixed(2)}</span>
                </div>
              </td>
              <td className="py-2 text-right">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-[10px] font-normal text-zinc-500">Paid Amount</span>
                  <span>{paidAmount.toFixed(2)}</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-6 ml-auto w-full max-w-xs space-y-1 text-sm">
          <SummaryRow label="Payable" value={payable} bold />

          {isFinalized && delta !== null && finalAmount !== null ? (
            <>
              {delta < 0 && <SummaryRow label="Advance -" value={delta} signed />}
              {delta > 0 && <SummaryRow label="Advance +" value={delta} signed />}
              <SummaryRow label="Final Paid" value={finalAmount} />
              <SummaryRow label="Total Advance" value={currentAdvanceBalance} bold />
            </>
          ) : !isFinalized && canFinalize ? (
            <div className="pt-2 print:hidden">
              <FinalizeSection
                organizationId={organizationId}
                workerId={workerId}
                weekStart={weekStart}
                weekEnd={weekEnd}
                payable={payable}
                currentAdvanceBalance={currentAdvanceBalance}
                defaultFinalAmount={defaultFinalAmount}
              />
            </div>
          ) : !isFinalized ? (
            <p className="pt-2 text-xs text-zinc-400">Pending finalization by an admin or owner.</p>
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
}: {
  label: string
  value: number
  bold?: boolean
  signed?: boolean
}) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span>{signed ? formatSigned(value) : value.toFixed(2)}</span>
    </div>
  )
}
