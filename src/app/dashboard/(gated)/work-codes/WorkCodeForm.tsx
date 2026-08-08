'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { checkWorkCodeAvailable, createWorkCode, type FormState } from './actions'
import { CodeAvailabilityHint, type CodeStatus } from './CodeAvailabilityHint'

const initialState: FormState = null

export function WorkCodeForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(createWorkCode, initialState)

  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [rate, setRate] = useState('')
  const [touched, setTouched] = useState<{ code?: boolean; description?: boolean; rate?: boolean }>({})
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle')
  const [, startChecking] = useTransition()

  const [formGeneration, setFormGeneration] = useState(0)
  const [lastHandledState, setLastHandledState] = useState<FormState>(null)
  if (state !== lastHandledState) {
    setLastHandledState(state)
    if (state?.success) {
      setCode('')
      setDescription('')
      setRate('')
      setTouched({})
      setCodeStatus('idle')
      setFormGeneration((g) => g + 1)
    }
  }

  function handleCodeChange(value: string) {
    setCode(value)
    setCodeStatus(value.trim() ? 'checking' : 'idle')
  }

  useEffect(() => {
    const trimmed = code.trim()
    if (!trimmed) return
    const timeout = setTimeout(() => {
      startChecking(async () => {
        const { available } = await checkWorkCodeAvailable(organizationId, trimmed)
        setCodeStatus(available ? 'available' : 'taken')
      })
    }, 400)
    return () => clearTimeout(timeout)
  }, [code, organizationId])

  return (
    <form
      key={formGeneration}
      action={formAction}
      className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <input type="hidden" name="organizationId" value={organizationId} />

      {state?.error && (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="w-28">
        <label htmlFor="code" className="block text-sm font-medium">
          Code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          placeholder="e.g. ST-01"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, code: true }))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {touched.code && !code.trim() && <p className="mt-1 text-xs text-red-600">Code is required</p>}
        <CodeAvailabilityHint status={codeStatus} />
      </div>

      <div className="flex-1 min-w-[200px]">
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          required
          placeholder="e.g. Stitching - shirt"
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
        <label htmlFor="rate" className="block text-sm font-medium">
          Rate
        </label>
        <input
          id="rate"
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
        disabled={pending || codeStatus === 'taken'}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add code'}
      </button>
    </form>
  )
}
