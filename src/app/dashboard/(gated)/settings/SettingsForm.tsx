'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { updateOrgSettings, type FormState } from './actions'
import { TIMEZONES, CURRENCIES, DATE_FORMATS } from '@/lib/preferences'

const initialState: FormState = null

export function SettingsForm({
  organizationId,
  currentWeekStartDay,
  currentTimezone,
  currentCurrency,
  currentDateFormat,
  currentShowDecimals,
  currentStandardDaysPerWeek,
  currentStandardHoursPerDay,
  currentOvertimeRateMultiplier,
  openPastWeeksCount,
}: {
  organizationId: string
  currentWeekStartDay: 'monday' | 'saturday'
  currentTimezone: string
  currentCurrency: string
  currentDateFormat: string
  currentShowDecimals: boolean
  currentStandardDaysPerWeek: number
  currentStandardHoursPerDay: number
  currentOvertimeRateMultiplier: number
  openPastWeeksCount: number
}) {
  const [state, formAction, pending] = useActionState(updateOrgSettings, initialState)

  // After a successful save, the action's own response — not the next
  // ambient page refresh — is the source of truth for what's displayed.
  // A realtime-triggered refresh (see RealtimeRefresh in dashboard
  // layout) can otherwise race the save's own automatic refresh and
  // redisplay pre-save data. `saveKey` only changes on a confirmed save,
  // which remounts the form below so its uncontrolled inputs re-adopt
  // their defaultValue/defaultChecked from the trusted saved values.
  const saved = state?.success ? state.saved : null
  const weekStartDay = saved?.weekStartDay ?? currentWeekStartDay
  const timezone = saved?.timezone ?? currentTimezone
  const currency = saved?.currency ?? currentCurrency
  const dateFormat = saved?.dateFormat ?? currentDateFormat
  const showDecimalsValue = saved?.showDecimals ?? currentShowDecimals
  const standardDaysPerWeek = saved?.standardDaysPerWeek ?? currentStandardDaysPerWeek
  const standardHoursPerDay = saved?.standardHoursPerDay ?? currentStandardHoursPerDay
  const overtimeRateMultiplier = saved?.overtimeRateMultiplier ?? currentOvertimeRateMultiplier
  const saveKey = state?.success ? String(state.savedAt) : 'initial'

  const [showDecimals, setShowDecimals] = useState(showDecimalsValue)
  const [selectedWeekStartDay, setSelectedWeekStartDay] = useState(weekStartDay)

  return (
    <form
      key={saveKey}
      action={formAction}
      className="max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="organizationId" value={organizationId} />

      <h2 className="text-sm font-semibold text-zinc-700">Weekly pay period</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Determines the default week shown when logging entries and viewing weekly slips. Weeks
        that are already finalized keep the boundaries they were finalized with, even if you
        change this later.
      </p>
      <p className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        Only change this right after finalizing every open week — not routinely. Switching
        mid-week is safe (nothing is lost), but it shortens the week currently in progress so the
        new schedule can start cleanly — immediately, if today already lines up with it — so
        it&apos;s best kept rare.
      </p>

      {state?.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.success && state.saved?.immediateRestart && (
        <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Saved. Today already matches the new schedule, so every worker&apos;s current week was
          just cut short to end yesterday.{' '}
          <Link href="/dashboard/slips" className="font-medium underline">
            Review and finalize those shortened weeks
          </Link>{' '}
          on the Weekly Slips page.
        </p>
      )}
      {state?.success && !state.saved?.immediateRestart && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>
      )}

      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 p-3 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50">
          <input
            type="radio"
            name="weekStartDay"
            value="monday"
            defaultChecked={weekStartDay === 'monday'}
            onChange={() => setSelectedWeekStartDay('monday')}
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
            defaultChecked={weekStartDay === 'saturday'}
            onChange={() => setSelectedWeekStartDay('saturday')}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-900">Saturday – Thursday</span>
            <span className="block text-xs text-zinc-500">Friday off. Week runs Saturday through Friday.</span>
          </span>
        </label>
      </div>

      {selectedWeekStartDay !== weekStartDay && openPastWeeksCount > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {`You have ${openPastWeeksCount} past week${openPastWeeksCount === 1 ? '' : 's'} that ${
            openPastWeeksCount === 1 ? 'was' : 'were'
          } never finalized. Switching won't change or lose any of that data, but afterward those weeks won't show up via the Weekly Slips ‹ › navigation anymore — you'll need Find weekly slip records to open them. Finalizing them first keeps navigation simple.`}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700">Date format</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Used to display dates across the app. Date pickers still show your browser&apos;s own format.
          </p>
          <select
            name="dateFormat"
            defaultValue={dateFormat}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {DATE_FORMATS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-zinc-700">Timezone</h2>
          <p className="mt-1 text-xs text-zinc-500">Used to display the time entries and payments were logged.</p>
          <select
            name="timezone"
            defaultValue={timezone}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-zinc-700">Currency</h2>
          <p className="mt-1 text-xs text-zinc-500">Used to format all amounts across the app.</p>
          <select
            name="currency"
            defaultValue={currency}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-700">Amount display</h2>
        <label className="mt-2 flex cursor-pointer items-start justify-between gap-3 rounded-md border border-zinc-200 p-3 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50">
          <span>
            <span className="block text-sm font-medium text-zinc-900">
              Always show two decimal places
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              {showDecimals
                ? 'On — every amount shows two decimal places, e.g. 150.00 and 150.50.'
                : 'Off — whole amounts drop the decimals (150 instead of 150.00) to keep tables less crowded. Amounts that actually have cents still show them (150.50).'}
            </span>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600">
              Preview: {showDecimals ? '150.00' : '150'} · {showDecimals ? '150.50' : '150.50'}
            </span>
          </span>
          <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-zinc-200 transition-colors has-[:checked]:bg-zinc-900">
            <input
              type="checkbox"
              name="showDecimals"
              defaultChecked={showDecimalsValue}
              onChange={(e) => setShowDecimals(e.target.checked)}
              className="peer sr-only"
            />
            <span className="ml-0.5 inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </span>
        </label>
        <p className="mt-2 text-xs text-zinc-400">
          Applies everywhere amounts are shown — entries, payments, and weekly slips. Click Save
          below for the change to take effect.
        </p>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-700">Attendance &amp; overtime</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Used to turn attendance (present/absent/half-day) into pay for weekly-salary and
          hybrid workers — a per-day rate is derived from their weekly salary, and overtime is
          paid on top at this multiplier. Doesn&apos;t affect contract workers.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="standardDaysPerWeek" className="block text-xs font-medium text-zinc-500">
              Standard days/week
            </label>
            <input
              id="standardDaysPerWeek"
              name="standardDaysPerWeek"
              type="number"
              step="1"
              min="1"
              max="7"
              required
              defaultValue={standardDaysPerWeek}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="standardHoursPerDay" className="block text-xs font-medium text-zinc-500">
              Standard hours/day
            </label>
            <input
              id="standardHoursPerDay"
              name="standardHoursPerDay"
              type="number"
              step="0.5"
              min="0.5"
              required
              defaultValue={standardHoursPerDay}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="overtimeRateMultiplier" className="block text-xs font-medium text-zinc-500">
              Overtime rate multiplier
            </label>
            <input
              id="overtimeRateMultiplier"
              name="overtimeRateMultiplier"
              type="number"
              step="0.1"
              min="0"
              required
              defaultValue={overtimeRateMultiplier}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
