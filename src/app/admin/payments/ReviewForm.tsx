'use client'

import { useActionState, useState } from 'react'
import { reviewPaymentSubmission, type FormState } from './actions'

const initialState: FormState = null

export function ReviewForm({ submissionId }: { submissionId: string }) {
  const [state, formAction, pending] = useActionState(reviewPaymentSubmission, initialState)
  const [rejecting, setRejecting] = useState(false)

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      {!rejecting ? (
        <div className="flex gap-2">
          <button
            type="submit"
            name="approve"
            value="true"
            disabled={pending}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            name="note"
            rows={2}
            placeholder="Reason for rejection…"
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              name="approve"
              value="false"
              disabled={pending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
