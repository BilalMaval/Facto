'use server'

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string } | null

async function friendlyAuthMessage(error: { code?: string; message: string }) {
  const t = await getTranslations('auth.errors')
  switch (error.code) {
    case 'invalid_credentials':
      return t('invalidCredentials')
    case 'email_not_confirmed':
      return t('emailNotConfirmed')
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return t('rateLimited')
    default:
      return (await getTranslations('common'))('genericError')
  }
}

export async function login(_prevState: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/dashboard')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: await friendlyAuthMessage(error) }
  }

  redirect(next)
}
