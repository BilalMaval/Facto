'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'

export type FormState = { error?: string; success?: boolean } | null

const MAX_PROOF_BYTES = 5 * 1024 * 1024
const METHODS = ['easypaisa', 'jazzcash', 'bank_transfer'] as const
const PURPOSES = ['subscription', 'plan_upgrade'] as const

export async function submitPaymentProof(_prevState: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  const amount = Number(formData.get('amount') ?? 0)
  const method = String(formData.get('method') ?? '')
  const transactionReference = String(formData.get('transactionReference') ?? '').trim()
  const paymentDate = String(formData.get('paymentDate') ?? '').trim()
  const proof = formData.get('proof') as File | null
  const purposeRaw = String(formData.get('purpose') ?? 'subscription')
  const purpose = PURPOSES.includes(purposeRaw as (typeof PURPOSES)[number]) ? purposeRaw : 'subscription'

  if (!METHODS.includes(method as (typeof METHODS)[number])) {
    return { error: 'Choose a payment method' }
  }
  if (!transactionReference) {
    return { error: 'Enter the transaction reference / ID' }
  }
  if (!paymentDate) {
    return { error: 'Enter the date you paid' }
  }
  if (!amount || amount <= 0) {
    return { error: 'Enter a valid amount' }
  }
  if (!proof || proof.size === 0) {
    return { error: 'Upload a screenshot of the payment as proof' }
  }
  if (proof.size > MAX_PROOF_BYTES) {
    return { error: 'Proof image must be under 5MB' }
  }
  if (!proof.type.startsWith('image/')) {
    return { error: 'Proof must be an image' }
  }

  const supabase = await createClient()
  const extension = proof.type.split('/')[1] || 'jpg'
  const path = `${organizationId}/${crypto.randomUUID()}/proof.${extension}`

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(path, proof, { contentType: proof.type })
  if (uploadError) {
    return { error: uploadError.message }
  }

  const user = await getResilientUser(supabase)
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error: insertError } = await supabase.from('payment_submissions').insert({
    organization_id: organizationId,
    amount,
    method,
    transaction_reference: transactionReference,
    payment_date: paymentDate,
    proof_path: path,
    proof_filename: proof.name,
    submitted_by: user.id,
    purpose,
  })
  if (insertError) {
    return { error: insertError.message }
  }

  revalidatePath('/dashboard/billing')
  revalidatePath('/dashboard/settings/upgrade')
  return { success: true }
}

export async function startFreeTrial(_prevState: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('start_free_trial', { p_org_id: organizationId })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}
