'use client'

import { useActionState } from 'react'
import { setHiddenTabs, type FormState } from '../../actions'

const initialState: FormState = null

const TABS = [
  { key: 'billing', label: 'Billing' },
  { key: 'support', label: 'Support' },
  { key: 'settings', label: 'Settings' },
] as const

export function VisibleTabsForm({ orgId, hiddenTabs }: { orgId: string; hiddenTabs: string[] }) {
  const [state, formAction, pending] = useActionState(setHiddenTabs, initialState)

  return (
    <form action={formAction} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="orgId" value={orgId} />
      <p className="text-xs text-zinc-400">
        Hide a tab for business owners who shouldn&apos;t see it (e.g. handled manually). Only affects
        the nav link — the page itself stays reachable directly.
      </p>

      {state?.error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.success && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>
      )}

      <div className="mt-4 space-y-2">
        {TABS.map((t) => (
          <label key={t.key} className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              name={t.key}
              defaultChecked={hiddenTabs.includes(t.key)}
              className="rounded border-zinc-300"
            />
            Hide {t.label} tab
          </label>
        ))}
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
