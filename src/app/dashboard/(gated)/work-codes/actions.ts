'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: boolean } | null

function friendlyMessage(error: { code?: string; message: string }) {
  if (error.code === '23505') {
    return 'A work code with that code already exists.'
  }
  return error.message
}

export async function checkWorkCodeAvailable(organizationId: string, code: string) {
  const trimmed = code.trim()
  if (!trimmed) return { available: true }

  const supabase = await createClient()
  const { data } = await supabase
    .from('work_codes')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('code', trimmed)
    .maybeSingle()

  return { available: !data }
}

export async function createWorkCode(_prevState: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const rate = Number(formData.get('rate') ?? '')

  if (!code || !description || !rate) {
    return { error: 'Code, description, and rate are required' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('work_codes').insert({
    organization_id: organizationId,
    code,
    description,
    rate,
  })

  if (error) {
    return { error: friendlyMessage(error) }
  }

  revalidatePath('/dashboard/work-codes')
  return { success: true }
}

export async function updateWorkCode(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') ?? '')
  const description = String(formData.get('description') ?? '').trim()
  const rate = Number(formData.get('rate') ?? '')

  if (!description || !rate) {
    return { error: 'Description and rate are required' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('work_codes')
    .update({ description, rate })
    .eq('id', id)

  if (error) {
    return { error: friendlyMessage(error) }
  }

  revalidatePath('/dashboard/work-codes')
  return { success: true }
}

export async function toggleWorkCodeActive(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const nextActive = formData.get('nextActive') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('work_codes')
    .update({ is_active: nextActive })
    .eq('id', id)

  if (error) {
    redirect(`/dashboard/work-codes?error=${encodeURIComponent(friendlyMessage(error))}`)
  }

  revalidatePath('/dashboard/work-codes')
}
