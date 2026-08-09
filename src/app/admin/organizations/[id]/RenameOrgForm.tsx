'use client'

import { useActionState } from 'react'
import { renameOrganization, type FormState } from '../../actions'

const initialState: FormState = null

export function RenameOrgForm({ orgId, currentName }: { orgId: string; currentName: string }) {
  const [state, formAction, pending] = useActionState(renameOrganization, initialState)

  return (
    <form action={formAction} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="orgId" value={orgId} />
      <h2 className="text-sm font-semibold text-zinc-700">Business name</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Renames this business on the owner&apos;s behalf — e.g. after a support request to correct or
        change their trading name.
      </p>

      {state?.error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.success && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>
      )}

      <div className="mt-4">
        <label htmlFor="rename-org-name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="rename-org-name"
          name="name"
          type="text"
          required
          defaultValue={currentName}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
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
