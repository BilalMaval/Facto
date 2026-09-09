'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrgRole } from '@/lib/session'
import { uploadObject } from '@/lib/storage/r2'

export type FormState = { error?: string; success?: boolean } | null

const MAX_PROOF_BYTES = 5 * 1024 * 1024
const METHODS = ['easypaisa', 'jazzcash', 'bank_transfer'] as const
const PURPOSES = ['subscription', 'plan_upgrade'] as const

export async function submitPaymentProof(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations()
  const organizationId = String(formData.get('organizationId') ?? '')
  const amount = Number(formData.get('amount') ?? 0)
  const method = String(formData.get('method') ?? '')
  const transactionReference = String(formData.get('transactionReference') ?? '').trim()
  const paymentDate = String(formData.get('paymentDate') ?? '').trim()
  const proof = formData.get('proof') as File | null
  const purposeRaw = String(formData.get('purpose') ?? 'subscription')
  const purpose = PURPOSES.includes(purposeRaw as (typeof PURPOSES)[number]) ? purposeRaw : 'subscription'

  if (!METHODS.includes(method as (typeof METHODS)[number])) {
    return { error: t('billing.errors.choosePaymentMethod') }
  }
  if (!transactionReference) {
    return { error: t('billing.errors.enterTransactionRef') }
  }
  if (!paymentDate) {
    return { error: t('billing.errors.enterPaymentDate') }
  }
  if (!amount || amount <= 0) {
    return { error: t('billing.errors.enterValidAmount') }
  }
  if (!proof || proof.size === 0) {
    return { error: t('billing.errors.uploadProof') }
  }
  if (proof.size > MAX_PROOF_BYTES) {
    return { error: t('billing.errors.proofTooLarge') }
  }
  if (!proof.type.startsWith('image/')) {
    return { error: t('billing.errors.proofMustBeImage') }
  }

  const membership = await requireOrgRole(organizationId, ['owner', 'admin'])
  if (!membership) {
    return { error: t('billing.errors.notAuthenticated') }
  }
  const user = membership.user

  const supabase = await createClient()
  const extension = proof.type.split('/')[1] || 'jpg'
  const path = `${organizationId}/${crypto.randomUUID()}/proof.${extension}`

  try {
    await uploadObject('payment-proofs', path, proof)
  } catch {
    return { error: t('common.genericError') }
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
    return { error: t('common.genericError') }
  }

  revalidatePath('/dashboard/billing')
  revalidatePath('/dashboard/settings/upgrade')
  return { success: true }
}

export async function startFreeTrial(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations('common')
  const organizationId = String(formData.get('organizationId') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.rpc('start_free_trial', { p_org_id: organizationId })

  if (error) {
    return { error: t('genericError') }
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}
