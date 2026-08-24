'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import type { FormState } from './actions'
import { wrappedCreateEntry } from '@/lib/offlineQueue/webAppWiring'
import { workerLabel } from '@/lib/format'
import { WorkCodeSearchSelect } from '../../_components/WorkCodeSearchSelect'
import { DatePicker } from '@/components/DatePicker'
import type { DateFormat } from '@/lib/dates'

type Worker = { id: string; worker_code: string | null; name: string }
type WorkCode = { id: string; code: string; description: string; rate: number }

const initialState: FormState = null

export function EntryForm({
  organizationId,
  today,
  workers,
  workCodes,
  dateFormat,
}: {
  organizationId: string
  today: string
  workers: Worker[]
  workCodes: WorkCode[]
  dateFormat: DateFormat
}) {
  const [state, formAction, pending] = useActionState(wrappedCreateEntry, initialState)

  const [entryDate, setEntryDate] = useState(today)
  const [workCodeId, setWorkCodeId] = useState(workCodes[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [quantityTouched, setQuantityTouched] = useState(false)

  // Only the quantity clears after a successful add — worker/date/work code
  // stay selected so staff can log several entries in a row quickly.
  const [quantityGeneration, setQuantityGeneration] = useState(0)
  const [lastHandledState, setLastHandledState] = useState<FormState>(null)
  // "Saved locally" is a one-time confirmation, not a standing status — the
  // bottom-right pending-count banner (OfflineQueueBanner) is what stays up
  // for as long as the item is actually still queued. Without this, the
  // message kept showing on whichever worker's form last rendered it, which
  // read as "this worker's change" even after switching to someone else's —
  // see quantityGeneration's key-based remount on worker switch, which now
  // also resets this, plus the timer below for staying on the same worker.
  const [showQueuedBanner, setShowQueuedBanner] = useState(false)
  if (state !== lastHandledState) {
    setLastHandledState(state)
    if (state?.success) {
      setQuantity('')
      setQuantityTouched(false)
      setQuantityGeneration((g) => g + 1)
    }
    if (state?.queued) setShowQueuedBanner(true)
  }
  useEffect(() => {
    if (!showQueuedBanner) return
    const timer = setTimeout(() => setShowQueuedBanner(false), 4000)
    return () => clearTimeout(timer)
  }, [showQueuedBanner])

  const selectedRate = useMemo(
    () => workCodes.find((wc) => wc.id === workCodeId)?.rate ?? 0,
    [workCodeId, workCodes]
  )
  const previewAmount = useMemo(() => {
    const qty = parseFloat(quantity)
    if (Number.isNaN(qty)) return 0
    return qty * selectedRate
  }, [quantity, selectedRate])

  const quantityInvalid = quantityTouched && !(parseFloat(quantity) > 0)

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
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
        <label htmlFor="entryDate" className="block text-sm font-medium">
          Date
        </label>
        <DatePicker
          id="entryDate"
          name="entryDate"
          value={entryDate}
          onChange={setEntryDate}
          dateFormat={dateFormat}
          className="mt-1"
        />
      </div>
      <div className="min-w-[180px] flex-1">
        <label htmlFor="workerId" className="block text-sm font-medium">
          Worker
        </label>
        <select
          id="workerId"
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
      <div className="min-w-[200px] flex-1">
        <label htmlFor="workCodeId" className="block text-sm font-medium">
          Work code
        </label>
        <WorkCodeSearchSelect
          id="workCodeId"
          workCodes={workCodes}
          value={workCodeId}
          onChange={setWorkCodeId}
        />
        <input type="hidden" name="workCodeId" value={workCodeId} />
      </div>
      <div className="w-28">
        <label htmlFor="quantity" className="block text-sm font-medium">
          Quantity
        </label>
        <input
          key={quantityGeneration}
          id="quantity"
          name="quantity"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={() => setQuantityTouched(true)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {quantityInvalid && <p className="mt-1 text-xs text-red-600">Enter a quantity greater than 0</p>}
      </div>
      <div className="w-32">
        <p className="block text-sm font-medium">Amount</p>
        <p className="mt-1 py-2 text-sm text-zinc-500">{previewAmount.toFixed(2)}</p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add entry'}
      </button>
    </form>
  )
}
