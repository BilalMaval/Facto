'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: boolean } | null

export async function createEntry(_prevState: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  const workerId = String(formData.get('workerId') ?? '')
  const entryDate = String(formData.get('entryDate') ?? '')
  const workCodeId = String(formData.get('workCodeId') ?? '')
  const quantity = Number(formData.get('quantity') ?? '')

  if (!workerId || !entryDate || !workCodeId || !quantity) {
    return { error: 'Worker, date, work code, and quantity are required' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('work_entries').insert({
    organization_id: organizationId,
    worker_id: workerId,
    entry_date: entryDate,
    work_code_id: workCodeId,
    quantity,
    created_by: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/entries')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteEntry(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('returnTo') ?? '/dashboard/entries')

  const supabase = await createClient()
  const { error } = await supabase.from('work_entries').delete().eq('id', id)

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/entries')
  revalidatePath('/dashboard')
}

export async function createPayment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  const workerId = String(formData.get('workerId') ?? '')
  const paymentDate = String(formData.get('paymentDate') ?? '')
  const amount = Number(formData.get('amount') ?? '')
  const note = String(formData.get('note') ?? '').trim()

  if (!workerId || !paymentDate || !amount) {
    return { error: 'Worker, date, and amount are required' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('payments').insert({
    organization_id: organizationId,
    worker_id: workerId,
    payment_date: paymentDate,
    amount,
    note: note || null,
    created_by: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/entries')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deletePayment(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('returnTo') ?? '/dashboard/entries')

  const supabase = await createClient()
  const { error } = await supabase.from('payments').delete().eq('id', id)

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/entries')
  revalidatePath('/dashboard')
}
