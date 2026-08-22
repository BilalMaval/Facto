'use client'

import { useActionState } from 'react'
import { startFreeTrial, type FormState } from './actions'

const initialState: FormState = null

export function StartTrialButton({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(startFreeTrial, initialState)

  return (
    <form action={formAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      {state?.error && <p className="mb-2 text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 sm:w-auto"
      >
        {pending ? 'Starting…' : 'Start free trial (3 days)'}
      </button>
    </form>
  )
}
