'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string } | null

export async function createAdditionalBusiness(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    return { error: 'Business name is required' }
  }

  const supabase = await createClient()
  const { data: orgId, error } = await supabase.rpc('create_organization', { p_name: name })

  if (error) {
    return { error: error.message }
  }

  const cookieStore = await cookies()
  cookieStore.set('active_org_id', orgId, { path: '/', httpOnly: true, sameSite: 'lax' })

  redirect('/dashboard/billing')
}
