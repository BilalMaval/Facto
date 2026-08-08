'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string } | null

export async function createOrganization(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    return { error: 'Organization name is required' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_organization', { p_name: name })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard/billing')
}
