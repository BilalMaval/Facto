'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string } | null

export async function createAdditionalBusiness(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    return { error: t('newBusiness.errors.nameRequired') }
  }

  const supabase = await createClient()
  const { data: orgId, error } = await supabase.rpc('create_organization', { p_name: name })

  if (error) {
    return { error: t('common.genericError') }
  }

  const cookieStore = await cookies()
  cookieStore.set('active_org_id', orgId, { path: '/', httpOnly: true, sameSite: 'lax' })

  redirect('/dashboard/billing')
}
