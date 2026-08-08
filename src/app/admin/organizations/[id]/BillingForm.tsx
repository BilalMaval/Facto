'use client'

import { useActionState } from 'react'
import { updateOrganizationBilling, type FormState } from '../../actions'

const initialState: FormState = null

type Org = {
  id: string
  name: string
  subscription_status: string
  monthly_fee: number | null
  billing_notes: string | null
}

export function BillingForm({ org }: { org: Org }) {
  const [state, formAction, pending] = useActionState(updateOrganizationBilling, initialState)

  return (
    <form
      action={formAction}
      className="max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="orgId" value={org.id} />

      {state?.error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.success && (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="subscriptionStatus" className="block text-sm font-medium">
            Manual override
          </label>
          <select
            id="subscriptionStatus"
            name="subscriptionStatus"
            defaultValue={org.subscription_status === 'trial' ? 'active' : org.subscription_status}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="active">None — follow billing cycle normally</option>
            <option value="suspended">Force suspend (blocks their access immediately)</option>
            <option value="cancelled">Cancelled (permanently blocks access)</option>
          </select>
          <p className="mt-1 text-xs text-zinc-400">
            This overrides the computed status below regardless of payment dates. To restore normal
            billing, set it back to &quot;None&quot; — that doesn&apos;t auto-reactivate an overdue
            account, it just removes the forced block.
          </p>
        </div>

        <div>
          <label htmlFor="monthlyFee" className="block text-sm font-medium">
            Monthly fee
          </label>
          <input
            id="monthlyFee"
            name="monthlyFee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={org.monthly_fee ?? ''}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="billingNotes" className="block text-sm font-medium">
            Billing notes
          </label>
          <textarea
            id="billingNotes"
            name="billingNotes"
            rows={3}
            defaultValue={org.billing_notes ?? ''}
            placeholder="Internal notes — payment method, discount agreed, renewal date…"
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
