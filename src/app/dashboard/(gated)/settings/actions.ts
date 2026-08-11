'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { TIMEZONES, CURRENCIES, DATE_FORMATS } from '@/lib/preferences'

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
      }
    }
  | null

export async function updateOrgSettings(_prevState: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  const weekStartDay = String(formData.get('weekStartDay') ?? '')
  const timezone = String(formData.get('timezone') ?? '')
  const currency = String(formData.get('currency') ?? '')
  const dateFormat = String(formData.get('dateFormat') ?? '')
  const showDecimals = formData.get('showDecimals') === 'on'

  if (weekStartDay !== 'monday' && weekStartDay !== 'saturday') {
    return { error: 'Choose a valid week type' }
  }
  if (!TIMEZONES.some((t) => t.value === timezone)) {
    return { error: 'Choose a valid timezone' }
  }
  if (!CURRENCIES.some((c) => c.value === currency)) {
    return { error: 'Choose a valid currency' }
  }
  if (!DATE_FORMATS.some((d) => d.value === dateFormat)) {
    return { error: 'Choose a valid date format' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .update({
      week_start_day: weekStartDay,
      timezone,
      currency,
      date_format: dateFormat,
      show_decimals: showDecimals,
    })
    .eq('id', organizationId)

  if (error) {
    return { error: error.message }
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
    },
  }
}
