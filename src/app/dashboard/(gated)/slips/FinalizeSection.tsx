'use client'

import { useMemo, useState } from 'react'
import { formatMoney, formatNumber, formatSigned } from '@/lib/format'
import { finalizeSlip } from './actions'
import { ConfirmButton } from './ConfirmButton'

function parseAmount(display: string) {
  const parsed = parseFloat(display.replace(/,/g, ''))
  return Number.isNaN(parsed) ? 0 : parsed
}

export function FinalizeSection({
  organizationId,
  workerId,
  weekStart,
  weekEnd,
  payable,
  currentAdvanceBalance,
  defaultFinalAmount,
  currency,
  showDecimals,
}: {
  organizationId: string
  workerId: string
  weekStart: string
  weekEnd: string
  payable: number
  currentAdvanceBalance: number
  defaultFinalAmount: number
  currency: string
  showDecimals: boolean
}) {
  const [finalAmount, setFinalAmount] = useState(() => formatNumber(defaultFinalAmount, showDecimals))

  const finalAmountNum = parseAmount(finalAmount)
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
      <input type="hidden" name="finalAmount" value={finalAmountNum} />

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="finalAmount-input" className="font-semibold">
          Final Amount
        </label>
        <input
          id="finalAmount-input"
          type="text"
          inputMode="decimal"
          required
          value={finalAmount}
          onChange={(e) => setFinalAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
          onBlur={() => setFinalAmount(formatNumber(parseAmount(finalAmount), showDecimals))}
          className="w-32 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm"
        />
      </div>

      {delta < 0 && (
        <SummaryRow label="Advance -" value={delta} signed currency={currency} showDecimals={showDecimals} />
      )}
      {delta > 0 && (
        <SummaryRow label="Advance +" value={delta} signed currency={currency} showDecimals={showDecimals} />
      )}
      <SummaryRow
        label="Total Advance (after finalizing)"
        value={projectedAdvance}
        bold
        currency={currency}
        showDecimals={showDecimals}
      />

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
