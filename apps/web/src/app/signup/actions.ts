'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string } | null

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
    return { error: error.message }
  }

  if (data.session) {
    redirect(next || '/onboarding')
  }

  redirect('/signup/check-email')
}
