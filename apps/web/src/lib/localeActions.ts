'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'
import { LOCALE_COOKIE, isLocale, type Locale } from '@/lib/locale'

export async function setPreferredLanguage(locale: Locale) {
  if (!isLocale(locale)) return

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, { path: '/', httpOnly: true, sameSite: 'lax' })

  const supabase = await createClient()
  const user = await getResilientUser(supabase)
  if (user) {
    await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, preferred_language: locale, updated_at: new Date().toISOString() })
  }

  revalidatePath('/', 'layout')
}
