'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: boolean } | null

async function friendlyMessage(error: { code?: string; message: string }) {
  const t = await getTranslations()
  if (error.code === '23505') {
    return t('workCodes.errors.codeTaken')
  }
  return t('common.genericError')
}

async function friendlyDeleteMessage(error: { code?: string; message: string }) {
  const t = await getTranslations()
  if (error.code === '23503') {
    return t('workCodes.errors.codeInUse')
  }
  return t('common.genericError')
}

export async function checkWorkCodeAvailable(organizationId: string, code: string, excludeId?: string) {
  const trimmed = code.trim()
  if (!trimmed) return { available: true }

  const supabase = await createClient()
  let query = supabase
    .from('work_codes')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('code', trimmed)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query.maybeSingle()

  return { available: !data }
}

export async function createWorkCode(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations('workCodes.errors')
  const organizationId = String(formData.get('organizationId') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const rate = Number(formData.get('rate') ?? '')

  if (!code || !description || !rate) {
    return { error: t('createRequiredFields') }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('work_codes').insert({
    organization_id: organizationId,
    code,
    description,
    rate,
  })

  if (error) {
    return { error: await friendlyMessage(error) }
  }

  revalidatePath('/dashboard/work-codes')
  return { success: true }
}

export async function updateWorkCode(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations('workCodes.errors')
  const id = String(formData.get('id') ?? '')
  const code = String(formData.get('code') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const rate = Number(formData.get('rate') ?? '')

  if (!code || !description || !rate) {
    return { error: t('updateRequiredFields') }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('work_codes')
    .update({ code, description, rate })
    .eq('id', id)

  if (error) {
    return { error: await friendlyMessage(error) }
  }

  revalidatePath('/dashboard/work-codes')
  return { success: true }
}

export async function duplicateWorkCode(formData: FormData) {
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()
  const { data: original } = await supabase
    .from('work_codes')
    .select('organization_id, code, description, rate')
    .eq('id', id)
    .maybeSingle()

  if (!original) {
    redirect(`/dashboard/work-codes?error=${encodeURIComponent((await getTranslations('common'))('genericError'))}`)
  }

  const { data: existing } = await supabase
    .from('work_codes')
    .select('code')
    .eq('organization_id', original.organization_id)
  const taken = new Set((existing ?? []).map((r) => r.code))

  let code = `${original.code}-copy`
  for (let n = 2; taken.has(code); n++) code = `${original.code}-copy-${n}`

  const { error } = await supabase.from('work_codes').insert({
    organization_id: original.organization_id,
    code,
    description: original.description,
    rate: original.rate,
  })

  if (error) {
    redirect(`/dashboard/work-codes?error=${encodeURIComponent(await friendlyMessage(error))}`)
  }

  revalidatePath('/dashboard/work-codes')
}

export async function deleteWorkCode(formData: FormData) {
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.from('work_codes').delete().eq('id', id)

  if (error) {
    redirect(`/dashboard/work-codes?error=${encodeURIComponent(await friendlyDeleteMessage(error))}`)
  }

  revalidatePath('/dashboard/work-codes')
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
    redirect(`/dashboard/work-codes?error=${encodeURIComponent(await friendlyMessage(error))}`)
  }

  revalidatePath('/dashboard/work-codes')
}
