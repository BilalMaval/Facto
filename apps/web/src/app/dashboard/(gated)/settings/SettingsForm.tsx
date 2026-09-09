'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const tz = useTranslations('settings.timezoneLabels')
  const cur = useTranslations('settings.currencyLabels')
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

      <h2 className="text-sm font-semibold text-zinc-700">{t('weeklyPayPeriodHeading')}</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {t('weeklyPayPeriodDescription')}
      </p>
      <p className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        {t('weeklyPayPeriodWarning')}
      </p>

      {state?.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.success && state.saved?.immediateRestart && (
        <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
          {t('savedImmediateRestart')}
          <Link href="/dashboard/slips" className="font-medium underline">
            {t('reviewShortenedWeeks')}
          </Link>
          {t('onWeeklySlipsPage')}
        </p>
      )}
      {state?.success && !state.saved?.immediateRestart && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{t('saved')}</p>
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
            <span className="block text-sm font-medium text-zinc-900">{t('mondaySaturdayLabel')}</span>
            <span className="block text-xs text-zinc-500">{t('mondaySaturdayDescription')}</span>
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
            <span className="block text-sm font-medium text-zinc-900">{t('saturdayThursdayLabel')}</span>
            <span className="block text-xs text-zinc-500">{t('saturdayThursdayDescription')}</span>
          </span>
        </label>
      </div>

      {selectedWeekStartDay !== weekStartDay && openPastWeeksCount > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('openWeeksWarning', { count: openPastWeeksCount })}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700">{t('dateFormatHeading')}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {t('dateFormatDescription')}
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
          <h2 className="text-sm font-semibold text-zinc-700">{t('timezoneHeading')}</h2>
          <p className="mt-1 text-xs text-zinc-500">{t('timezoneDescription')}</p>
          <select
            name="timezone"
            defaultValue={timezone}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {TIMEZONES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {tz(opt.value)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-zinc-700">{t('currencyHeading')}</h2>
          <p className="mt-1 text-xs text-zinc-500">{t('currencyDescription')}</p>
          <select
            name="currency"
            defaultValue={currency}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {cur(c.value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-700">{t('amountDisplayHeading')}</h2>
        <label className="mt-2 flex cursor-pointer items-start justify-between gap-3 rounded-md border border-zinc-200 p-3 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50">
          <span>
            <span className="block text-sm font-medium text-zinc-900">
              {t('alwaysShowDecimals')}
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              {showDecimals ? t('decimalsOnDescription') : t('decimalsOffDescription')}
            </span>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600">
              {t('previewLabel', { a: showDecimals ? '150.00' : '150', b: showDecimals ? '150.50' : '150.50' })}
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
            {/* translate-x uses a physical (not logical) axis — CSS
                transforms never follow `dir` on their own — so the checked
                state needs its own rtl: variant to slide toward the
                opposite physical edge instead of visually "uncrossing"
                the toggle in RTL. */}
            <span className="ms-0.5 inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5" />
          </span>
        </label>
        <p className="mt-2 text-xs text-zinc-400">
          {t('decimalsApplyNote')}
        </p>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-700">{t('attendanceOvertimeHeading')}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {t('attendanceOvertimeDescription')}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="standardDaysPerWeek" className="block text-xs font-medium text-zinc-500">
              {t('standardDaysPerWeekLabel')}
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
              {t('standardHoursPerDayLabel')}
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
              {t('overtimeRateMultiplierLabel')}
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
        {pending ? tc('saving') : tc('save')}
      </button>
    </form>
  )
}
