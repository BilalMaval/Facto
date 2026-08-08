'use client'

import { useActionState } from 'react'
import { createTicket, type FormState } from './actions'

const initialState: FormState = null

export function NewTicketForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(createTicket, initialState)

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="organizationId" value={organizationId} />

      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div>
        <label htmlFor="subject" className="block text-sm font-medium">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          placeholder="What do you need help with?"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          rows={3}
          required
          placeholder="Describe the issue…"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send to support'}
      </button>
    </form>
  )
}
