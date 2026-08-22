'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get('token') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.rpc('accept_invitation', { p_token: token })

  if (error) {
    redirect(`/invite/${token}?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/dashboard')
}
