'use client'

import { useActionState, useState } from 'react'
import { updateWeekStartDay, type FormState } from './actions'

const initialState: FormState = null

export function SettingsForm({
  organizationId,
  currentWeekStartDay,
}: {
  organizationId: string
  currentWeekStartDay: 'monday' | 'saturday'
}) {
  const [state, formAction, pending] = useActionState(updateWeekStartDay, initialState)
  const [weekStartDay, setWeekStartDay] = useState(currentWeekStartDay)

  return (
    <form action={formAction} className="max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="organizationId" value={organizationId} />

      <h2 className="text-sm font-semibold text-zinc-700">Weekly pay period</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Determines the default week shown when logging entries and viewing weekly slips. Weeks
        that are already finalized keep the boundaries they were finalized with, even if you
        change this later.
      </p>

      {state?.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.success && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>
      )}

      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 p-3 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50">
          <input
            type="radio"
            name="weekStartDay"
            value="monday"
            checked={weekStartDay === 'monday'}
            onChange={() => setWeekStartDay('monday')}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-900">Monday – Saturday</span>
            <span className="block text-xs text-zinc-500">Sunday off. Week runs Monday through Sunday.</span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 p-3 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50">
          <input
            type="radio"
            name="weekStartDay"
            value="saturday"
            checked={weekStartDay === 'saturday'}
            onChange={() => setWeekStartDay('saturday')}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-900">Saturday – Thursday</span>
            <span className="block text-xs text-zinc-500">Friday off. Week runs Saturday through Friday.</span>
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
