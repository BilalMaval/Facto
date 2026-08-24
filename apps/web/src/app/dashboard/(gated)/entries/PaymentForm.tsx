'use client'

import { useActionState, useEffect, useState } from 'react'
import type { FormState } from './actions'
import { wrappedCreatePayment } from '@/lib/offlineQueue/webAppWiring'
import { workerLabel } from '@/lib/format'
import { DatePicker } from '@/components/DatePicker'
import type { DateFormat } from '@/lib/dates'

type Worker = { id: string; worker_code: string | null; name: string }

const initialState: FormState = null

export function PaymentForm({
  organizationId,
  today,
  workers,
  dateFormat,
}: {
  organizationId: string
  today: string
  workers: Worker[]
  dateFormat: DateFormat
}) {
  const [state, formAction, pending] = useActionState(wrappedCreatePayment, initialState)

  const [paymentDate, setPaymentDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [note, setNote] = useState('')

  // Only amount/note clear after a successful log — worker/date stay selected
  // so staff can log several payments in a row quickly.
  const [fieldsGeneration, setFieldsGeneration] = useState(0)
  const [lastHandledState, setLastHandledState] = useState<FormState>(null)
  // "Saved locally" is a one-time confirmation, not a standing status — the
  // bottom-right pending-count banner (OfflineQueueBanner) is what stays up
  // for as long as the item is actually still queued.
  const [showQueuedBanner, setShowQueuedBanner] = useState(false)
  if (state !== lastHandledState) {
    setLastHandledState(state)
    if (state?.success) {
      setAmount('')
      setAmountTouched(false)
      setNote('')
      setFieldsGeneration((g) => g + 1)
    }
    if (state?.queued) setShowQueuedBanner(true)
  }
  useEffect(() => {
    if (!showQueuedBanner) return
    const timer = setTimeout(() => setShowQueuedBanner(false), 4000)
    return () => clearTimeout(timer)
  }, [showQueuedBanner])

  const amountInvalid = amountTouched && !(parseFloat(amount) > 0)

  return (
    <form
      action={formAction}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <input type="hidden" name="organizationId" value={organizationId} />

      {state?.error && (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {showQueuedBanner && (
        <p className="w-full rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Saved locally — will sync when back online.
        </p>
      )}

      <div className="w-40">
        <label htmlFor="paymentDate" className="block text-sm font-medium">
          Date
        </label>
        <DatePicker
          id="paymentDate"
          name="paymentDate"
          value={paymentDate}
          onChange={setPaymentDate}
          dateFormat={dateFormat}
          className="mt-1"
        />
      </div>
      <div className="min-w-[180px] flex-1">
        <label htmlFor="paymentWorkerId" className="block text-sm font-medium">
          Worker
        </label>
        <select
          id="paymentWorkerId"
          name="workerId"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {workerLabel(w)}
            </option>
          ))}
        </select>
      </div>
      <div className="w-32">
        <label htmlFor="amount" className="block text-sm font-medium">
          Amount paid
        </label>
        <input
          key={fieldsGeneration}
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => setAmountTouched(true)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {amountInvalid && <p className="mt-1 text-xs text-red-600">Enter an amount greater than 0</p>}
      </div>
      <div className="min-w-[160px] flex-1">
        <label htmlFor="note" className="block text-sm font-medium">
          Note (optional)
        </label>
        <input
          key={`note-${fieldsGeneration}`}
          id="note"
          name="note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? 'Logging…' : 'Log payment'}
      </button>
    </form>
  )
}
