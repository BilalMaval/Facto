'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string } | null

async function friendlyAuthMessage(error: { code?: string; message: string }) {
  const t = await getTranslations('auth.errors')
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return t('userAlreadyExists')
    case 'weak_password':
      return t('weakPassword')
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return t('rateLimited')
    default:
      return (await getTranslations('common'))('genericError')
  }
}

export async function signup(_prevState: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')

  const origin = (await headers()).get('origin')
  const callbackUrl = new URL('/auth/callback', origin ?? undefined)
  if (next) callbackUrl.searchParams.set('next', next)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl.toString() },
  })

  if (error) {
    return { error: await friendlyAuthMessage(error) }
  }

  if (data.session) {
    redirect(next || '/onboarding')
  }

  redirect('/signup/check-email')
}
