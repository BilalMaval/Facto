'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { calculateAge } from '@/lib/age'
import { formatCnic } from '@/lib/cnic'
import { checkWorkerCodeAvailable, createWorker, type FormState } from './actions'
import { Field } from './Field'
import { CodeAvailabilityHint, type CodeStatus } from './CodeAvailabilityHint'

const initialState: FormState = null

export function WorkerForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(createWorker, initialState)

  const [workerCode, setWorkerCode] = useState('')
  const [name, setName] = useState('')
  const [cnic, setCnic] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [touched, setTouched] = useState<{ workerCode?: boolean; name?: boolean }>({})
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle')
  const [, startChecking] = useTransition()

  // Reset the form once per successful submission. Comparing against the
  // last-seen action state and adjusting during render (rather than in an
  // effect) is React's recommended pattern for this — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [formGeneration, setFormGeneration] = useState(0)
  const [lastHandledState, setLastHandledState] = useState<FormState>(null)
  if (state !== lastHandledState) {
    setLastHandledState(state)
    if (state?.success) {
      setWorkerCode('')
      setName('')
      setCnic('')
      setDateOfBirth('')
      setTouched({})
      setCodeStatus('idle')
      setFormGeneration((g) => g + 1)
    }
  }

  function handleWorkerCodeChange(value: string) {
    setWorkerCode(value)
    setCodeStatus(value.trim() ? 'checking' : 'idle')
  }

  useEffect(() => {
    const code = workerCode.trim()
    if (!code) return
    const timeout = setTimeout(() => {
      startChecking(async () => {
        const { available } = await checkWorkerCodeAvailable(organizationId, code)
        setCodeStatus(available ? 'available' : 'taken')
      })
    }, 400)
    return () => clearTimeout(timeout)
  }, [workerCode, organizationId])

  const age = calculateAge(dateOfBirth)

  return (
    <form
      key={formGeneration}
      action={formAction}
      className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2"
    >
      <input type="hidden" name="organizationId" value={organizationId} />

      {state?.error && (
        <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div>
        <label htmlFor="new-workerCode" className="block text-xs font-medium text-zinc-500">
          Worker ID
        </label>
        <input
          id="new-workerCode"
          name="workerCode"
          type="text"
          required
          placeholder="e.g. W-001"
          value={workerCode}
          onChange={(e) => handleWorkerCodeChange(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, workerCode: true }))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {touched.workerCode && !workerCode.trim() && (
          <p className="mt-1 text-xs text-red-600">Worker ID is required</p>
        )}
        <CodeAvailabilityHint status={codeStatus} />
      </div>

      <div>
        <label htmlFor="new-name" className="block text-xs font-medium text-zinc-500">
          Name
        </label>
        <input
          id="new-name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {touched.name && !name.trim() && <p className="mt-1 text-xs text-red-600">Name is required</p>}
      </div>

      <Field label="Father's name" name="fatherName" />
      <Field label="Contact no." name="contactNo" />
      <Field label="Designation" name="designation" />
      <Field label="Address" name="address" />

      <div>
        <label htmlFor="new-cnic" className="block text-xs font-medium text-zinc-500">
          CNIC
        </label>
        <input
          id="new-cnic"
          name="cnic"
          type="text"
          inputMode="numeric"
          placeholder="34101-1234567-1"
          maxLength={15}
          value={cnic}
          onChange={(e) => setCnic(formatCnic(e.target.value))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="new-dateOfBirth" className="block text-xs font-medium text-zinc-500">
          Date of birth
        </label>
        <input
          id="new-dateOfBirth"
          name="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {age !== null && <p className="mt-1 text-xs text-zinc-500">Age: {age}</p>}
      </div>

      <div>
        <label htmlFor="new-advanceBalance" className="block text-xs font-medium text-zinc-500">
          Total Advance
        </label>
        <input
          id="new-advanceBalance"
          name="advanceBalance"
          type="number"
          step="0.01"
          defaultValue="0"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending || codeStatus === 'taken'}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add worker'}
        </button>
      </div>
    </form>
  )
}
