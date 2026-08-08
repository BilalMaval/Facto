'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: boolean } | null

export async function updateWeekStartDay(_prevState: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  const weekStartDay = String(formData.get('weekStartDay') ?? '')

  if (weekStartDay !== 'monday' && weekStartDay !== 'saturday') {
    return { error: 'Choose a valid week type' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .update({ week_start_day: weekStartDay })
    .eq('id', organizationId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/slips')
  revalidatePath('/dashboard/entries')
  return { success: true }
}
