'use client'

import { useActionState } from 'react'
import { adjustBillingDates, type FormState } from '../../actions'

const initialState: FormState = null

type Org = {
  id: string
  subscribed_at: string | null
  paid_until: string | null
  suspension_note: string | null
}

export function BillingCycleForm({ org }: { org: Org }) {
  const [state, formAction, pending] = useActionState(adjustBillingDates, initialState)

  return (
    <form
      action={formAction}
      className="max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="orgId" value={org.id} />
      <p className="text-xs text-zinc-400">
        Manual override — for goodwill extensions or corrections. Normal renewals should go through
        Payments instead.
      </p>

      {state?.error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.success && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>
      )}

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="subscribedAt" className="block text-sm font-medium">
              Subscribed since
            </label>
            <input
              id="subscribedAt"
              name="subscribedAt"
              type="date"
              defaultValue={org.subscribed_at ?? ''}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="paidUntil" className="block text-sm font-medium">
              Paid until
            </label>
            <input
              id="paidUntil"
              name="paidUntil"
              type="date"
              defaultValue={org.paid_until ?? ''}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="suspensionNote" className="block text-sm font-medium">
            Suspension note
          </label>
          <textarea
            id="suspensionNote"
            name="suspensionNote"
            rows={2}
            defaultValue={org.suspension_note ?? ''}
            placeholder="Shown to the business owner while suspended…"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
