'use server'

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

async function friendlyInviteMessage(error: { message: string }) {
  const t = await getTranslations('invite.errors')
  if (error.message.includes('not found or expired')) return t('notFoundOrExpired')
  if (error.message.includes('different email')) return t('wrongEmail')
  return (await getTranslations('common'))('genericError')
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get('token') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.rpc('accept_invitation', { p_token: token })

  if (error) {
    redirect(`/invite/${token}?error=${encodeURIComponent(await friendlyInviteMessage(error))}`)
  }

  redirect('/dashboard')
}
