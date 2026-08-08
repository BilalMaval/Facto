'use client'

import { useActionState, useMemo, useState } from 'react'
import { createEntry, type FormState } from './actions'

type Worker = { id: string; worker_code: string; name: string }
type WorkCode = { id: string; code: string; description: string; rate: number }

const initialState: FormState = null

export function EntryForm({
  organizationId,
  today,
  workers,
  workCodes,
}: {
  organizationId: string
  today: string
  workers: Worker[]
  workCodes: WorkCode[]
}) {
  const [state, formAction, pending] = useActionState(createEntry, initialState)

  const [workCodeId, setWorkCodeId] = useState(workCodes[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [quantityTouched, setQuantityTouched] = useState(false)

  // Only the quantity clears after a successful add — worker/date/work code
  // stay selected so staff can log several entries in a row quickly.
  const [quantityGeneration, setQuantityGeneration] = useState(0)
  const [lastHandledState, setLastHandledState] = useState<FormState>(null)
  if (state !== lastHandledState) {
    setLastHandledState(state)
    if (state?.success) {
      setQuantity('')
      setQuantityTouched(false)
      setQuantityGeneration((g) => g + 1)
    }
  }

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

      <div className="w-40">
        <label htmlFor="entryDate" className="block text-sm font-medium">
          Date
        </label>
        <input
          id="entryDate"
          name="entryDate"
          type="date"
          required
          defaultValue={today}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
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
              {w.worker_code} — {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[200px] flex-1">
        <label htmlFor="workCodeId" className="block text-sm font-medium">
          Work code
        </label>
        <select
          id="workCodeId"
          name="workCodeId"
          required
          value={workCodeId}
          onChange={(e) => setWorkCodeId(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {workCodes.map((wc) => (
            <option key={wc.id} value={wc.id}>
              {wc.code} — {wc.description} (@{Number(wc.rate).toFixed(2)})
            </option>
          ))}
        </select>
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
