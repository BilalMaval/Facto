'use client'

import { useMemo, useState } from 'react'
import { formatMoney, formatNumber, formatSigned } from '@/lib/format'
import { finalizeSlip } from './actions'

function parseAmount(display: string) {
  const parsed = parseFloat(display.replace(/,/g, ''))
  return Number.isNaN(parsed) ? 0 : parsed
}

export function FinalizeSection({
  organizationId,
  workerId,
  weekStart,
  weekEnd,
  returnTo,
  payable,
  currentAdvanceBalance,
  currency,
  showDecimals,
}: {
  organizationId: string
  workerId: string
  weekStart: string
  weekEnd: string
  returnTo: string
  payable: number
  currentAdvanceBalance: number
  currency: string
  showDecimals: boolean
}) {
  // Deliberately starts empty rather than pre-filled with the computed
  // payable amount — an admin should type the amount they're actually
  // paying, not accept a default without looking at it.
  const [finalAmount, setFinalAmount] = useState('')

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
      <input type="hidden" name="returnTo" value={returnTo} />
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
          placeholder="Enter amount to pay"
          value={finalAmount}
          onChange={(e) => setFinalAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
          onBlur={() => {
            // Don't turn "still empty" into a formatted "0" — leave the
            // placeholder showing until something's actually typed.
            if (finalAmount.trim() !== '') setFinalAmount(formatNumber(parseAmount(finalAmount), showDecimals))
          }}
          className="w-40 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm"
        />
      </div>

      {finalAmount.trim() !== '' && (
        <>
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
        </>
      )}

      <div className="pt-2">
        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Finalize week
        </button>
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
