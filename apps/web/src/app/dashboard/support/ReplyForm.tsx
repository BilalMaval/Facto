'use client'

import { useActionState, useState } from 'react'
import { postReply, type FormState } from './actions'

const initialState: FormState = null

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, pending] = useActionState(postReply, initialState)
  const [formGeneration, setFormGeneration] = useState(0)
  const [lastHandledState, setLastHandledState] = useState<FormState>(null)
  if (state !== lastHandledState) {
    setLastHandledState(state)
    if (state?.success) setFormGeneration((g) => g + 1)
  }

  return (
    <form key={formGeneration} action={formAction} className="mt-4 space-y-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <textarea
        name="body"
        rows={3}
        required
        placeholder="Write a reply…"
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Reply'}
      </button>
    </form>
  )
}
