'use server'

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string } | null

export async function createOrganization(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    return { error: t('auth.onboarding.orgNameRequired') }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_organization', { p_name: name })

  if (error) {
    return { error: t('common.genericError') }
  }

  redirect('/dashboard/billing')
}
