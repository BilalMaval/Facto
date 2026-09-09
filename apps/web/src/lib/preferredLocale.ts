import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'
import { LOCALE_COOKIE, DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/locale'

export async function getPreferredLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value
  if (isLocale(cookieValue)) return cookieValue

  // No cookie yet — most likely a signed-in user on a new browser/device.
  // Read-only fallback to their DB-stored preference; the cookie itself only
  // gets (re)written when they next use the switcher (see localeActions.ts).
  const supabase = await createClient()
  const user = await getResilientUser(supabase)
  if (!user) return DEFAULT_LOCALE

  const { data } = await supabase
    .from('user_settings')
    .select('preferred_language')
    .eq('user_id', user.id)
    .maybeSingle()

  return isLocale(data?.preferred_language) ? data.preferred_language : DEFAULT_LOCALE
}
