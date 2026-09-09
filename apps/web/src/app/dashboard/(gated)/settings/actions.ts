'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { TIMEZONES, CURRENCIES, DATE_FORMATS } from '@/lib/preferences'
import { nextAnchorOnOrAfter, today, type WeekStartDay } from '@/lib/dates'

export type FormState =
  | {
      error?: string
      success?: boolean
      savedAt?: number
      saved?: {
        weekStartDay: 'monday' | 'saturday'
        timezone: string
        currency: string
        dateFormat: string
        showDecimals: boolean
        standardDaysPerWeek: number
        standardHoursPerDay: number
        overtimeRateMultiplier: number
        // True when this save just cut short every worker's currently-
        // running week — because today already happens to be the new
        // scheme's own anchor day, so the new scheme starts immediately
        // instead of after the usual short transition stretch. Lets the
        // form prompt to go finalize those shortened weeks right away.
        immediateRestart: boolean
      }
    }
  | null

export async function updateOrgSettings(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations('settings.errors')
  const tc = await getTranslations('common')
  const organizationId = String(formData.get('organizationId') ?? '')
  const weekStartDay = String(formData.get('weekStartDay') ?? '')
  const timezone = String(formData.get('timezone') ?? '')
  const currency = String(formData.get('currency') ?? '')
  const dateFormat = String(formData.get('dateFormat') ?? '')
  const showDecimals = formData.get('showDecimals') === 'on'
  const standardDaysPerWeek = Number(formData.get('standardDaysPerWeek') ?? '')
  const standardHoursPerDay = Number(formData.get('standardHoursPerDay') ?? '')
  const overtimeRateMultiplier = Number(formData.get('overtimeRateMultiplier') ?? '')

  if (weekStartDay !== 'monday' && weekStartDay !== 'saturday') {
    return { error: t('invalidWeekType') }
  }
  if (!TIMEZONES.some((tz) => tz.value === timezone)) {
    return { error: t('invalidTimezone') }
  }
  if (!CURRENCIES.some((c) => c.value === currency)) {
    return { error: t('invalidCurrency') }
  }
  if (!DATE_FORMATS.some((d) => d.value === dateFormat)) {
    return { error: t('invalidDateFormat') }
  }
  if (!Number.isInteger(standardDaysPerWeek) || standardDaysPerWeek < 1 || standardDaysPerWeek > 7) {
    return { error: t('invalidStandardDays') }
  }
  if (!(standardHoursPerDay > 0)) {
    return { error: t('invalidStandardHours') }
  }
  if (!(overtimeRateMultiplier >= 0)) {
    return { error: t('invalidOvertimeMultiplier') }
  }

  const supabase = await createClient()

  // Only stamp a new transition when Week Start Day is actually changing —
  // re-saving the rest of the form with the same value must not reset it.
  // See lib/dates.ts (WeekScheme/resolveWeekBounds) for why this single
  // most-recent transition record is what lets old and new weeks coexist
  // cleanly instead of a mid-week switch silently reshuffling data.
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('week_start_day')
    .eq('id', organizationId)
    .single()
  const isSchemeChange = existingOrg && existingOrg.week_start_day !== weekStartDay
  const transitionDate = today()
  // The new scheme can start the very same day when that day already
  // happens to be its own anchor day — see nextAnchorOnOrAfter in
  // lib/dates.ts — instead of only after the usual short transition
  // stretch. Worth flagging back to the form so it can prompt the owner to
  // go finalize the now-shortened current week right away.
  const immediateRestart =
    Boolean(isSchemeChange) && nextAnchorOnOrAfter(transitionDate, weekStartDay as WeekStartDay) === transitionDate

  const { error } = await supabase
    .from('organizations')
    .update({
      week_start_day: weekStartDay,
      ...(isSchemeChange
        ? {
            week_scheme_previous_start_day: existingOrg.week_start_day,
            week_scheme_transition_date: transitionDate,
          }
        : {}),
      timezone,
      currency,
      date_format: dateFormat,
      show_decimals: showDecimals,
      standard_days_per_week: standardDaysPerWeek,
      standard_hours_per_day: standardHoursPerDay,
      overtime_rate_multiplier: overtimeRateMultiplier,
    })
    .eq('id', organizationId)

  if (error) {
    return { error: tc('genericError') }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/slips')
  revalidatePath('/dashboard/entries')
  revalidatePath('/dashboard/workers')

  // Returned directly from this same request/response — the form uses
  // this as the source of truth for what's now displayed, instead of
  // whatever the next page refresh happens to fetch. A realtime-triggered
  // refresh (see RealtimeRefresh) can otherwise race this save's own
  // automatic refresh and briefly redisplay pre-save data.
  return {
    success: true,
    savedAt: Date.now(),
    saved: {
      weekStartDay: weekStartDay as 'monday' | 'saturday',
      timezone,
      currency,
      dateFormat,
      showDecimals,
      standardDaysPerWeek,
      standardHoursPerDay,
      overtimeRateMultiplier,
      immediateRestart,
    },
  }
}
