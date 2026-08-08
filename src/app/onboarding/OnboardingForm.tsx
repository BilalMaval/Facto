'use client'

import { useActionState, useState } from 'react'
import { createOrganization, type FormState } from './actions'

const initialState: FormState = null

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialState)

  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)

  const nameEmpty = touched && !name.trim()

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Organization name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Riverside Garments Ltd"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {nameEmpty && <p className="mt-1 text-xs text-red-600">Organization name is required</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create organization'}
      </button>
    </form>
  )
}
