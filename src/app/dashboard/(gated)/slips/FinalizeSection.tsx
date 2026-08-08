'use client'

import { useMemo, useState } from 'react'
import { formatSigned } from '@/lib/format'
import { finalizeSlip } from './actions'
import { ConfirmButton } from './ConfirmButton'

export function FinalizeSection({
  organizationId,
  workerId,
  weekStart,
  weekEnd,
  payable,
  currentAdvanceBalance,
  defaultFinalAmount,
}: {
  organizationId: string
  workerId: string
  weekStart: string
  weekEnd: string
  payable: number
  currentAdvanceBalance: number
  defaultFinalAmount: number
}) {
  const [finalAmount, setFinalAmount] = useState(defaultFinalAmount.toFixed(2))

  const parsed = parseFloat(finalAmount)
  const finalAmountNum = Number.isNaN(parsed) ? 0 : parsed
  const delta = finalAmountNum - payable
  const projectedAdvance = useMemo(
    () => currentAdvanceBalance + delta,
    [currentAdvanceBalance, delta]
  )

  return (
    <form action={finalizeSlip} className="space-y-1 text-sm">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="workerId" value={workerId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="weekEnd" value={weekEnd} />

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="finalAmount" className="font-semibold">
          Final Amount
        </label>
        <input
          id="finalAmount"
          name="finalAmount"
          type="number"
          step="0.01"
          min="0"
          required
          value={finalAmount}
          onChange={(e) => setFinalAmount(e.target.value)}
          className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm"
        />
      </div>

      {delta < 0 && <SummaryRow label="Advance -" value={delta} signed />}
      {delta > 0 && <SummaryRow label="Advance +" value={delta} signed />}
      <SummaryRow label="Total Advance (after finalizing)" value={projectedAdvance} bold />

      <div className="pt-2">
        <ConfirmButton
          confirmText="Finalize this week with this Final Amount? This locks entries and payments in this date range and updates the worker's advance balance."
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Finalize week
        </ConfirmButton>
      </div>
    </form>
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
