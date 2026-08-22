'use client'

import { useActionState, useState } from 'react'
import { toggleWorkCodeActive, updateWorkCode, type FormState } from './actions'

type WorkCode = {
  id: string
  code: string
  description: string
  rate: number
  is_active: boolean
}

const initialState: FormState = null

export function WorkCodeRow({ workCode }: { workCode: WorkCode }) {
  const [state, formAction, pending] = useActionState(updateWorkCode, initialState)

  const [description, setDescription] = useState(workCode.description)
  const [rate, setRate] = useState(String(workCode.rate))
  const [touched, setTouched] = useState<{ description?: boolean; rate?: boolean }>({})

  return (
    <div className="flex flex-wrap items-end gap-3 py-4">
      <div className="w-28">
        <p className="text-xs font-medium text-zinc-500">Code</p>
        <p className="mt-1 py-2 text-sm font-medium">{workCode.code}</p>
      </div>

      <form action={formAction} className="flex flex-1 flex-wrap items-end gap-3 min-w-[280px]">
        <input type="hidden" name="id" value={workCode.id} />

        {state?.error && (
          <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <div className="flex-1 min-w-[180px]">
          <label htmlFor={`description-${workCode.id}`} className="block text-xs font-medium text-zinc-500">
            Description
          </label>
          <input
            id={`description-${workCode.id}`}
            name="description"
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, description: true }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          {touched.description && !description.trim() && (
            <p className="mt-1 text-xs text-red-600">Description is required</p>
          )}
        </div>
        <div className="w-32">
          <label htmlFor={`rate-${workCode.id}`} className="block text-xs font-medium text-zinc-500">
            Rate
          </label>
          <input
            id={`rate-${workCode.id}`}
            name="rate"
            type="number"
            step="0.01"
            min="0"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, rate: true }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          {touched.rate && !(parseFloat(rate) > 0) && (
            <p className="mt-1 text-xs text-red-600">Rate must be greater than 0</p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>

      <form action={toggleWorkCodeActive}>
        <input type="hidden" name="id" value={workCode.id} />
        <input type="hidden" name="nextActive" value={(!workCode.is_active).toString()} />
        <button
          type="submit"
          className={`rounded-md px-3 py-2 text-sm ${
            workCode.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {workCode.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </form>
    </div>
  )
}
