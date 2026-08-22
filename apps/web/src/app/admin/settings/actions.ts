'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: boolean } | null

export async function updatePlatformSettings(_prevState: FormState, formData: FormData): Promise<FormState> {
  const easypaisaNumber = String(formData.get('easypaisaNumber') ?? '').trim()
  const easypaisaTitle = String(formData.get('easypaisaTitle') ?? '').trim()
  const easypaisaNote = String(formData.get('easypaisaNote') ?? '').trim()
  const jazzcashNumber = String(formData.get('jazzcashNumber') ?? '').trim()
  const jazzcashTitle = String(formData.get('jazzcashTitle') ?? '').trim()
  const jazzcashNote = String(formData.get('jazzcashNote') ?? '').trim()
  const bankName = String(formData.get('bankName') ?? '').trim()
  const bankAccountTitle = String(formData.get('bankAccountTitle') ?? '').trim()
  const bankAccountNumber = String(formData.get('bankAccountNumber') ?? '').trim()
  const bankIban = String(formData.get('bankIban') ?? '').trim()
  const bankNote = String(formData.get('bankNote') ?? '').trim()
  const supportEmail = String(formData.get('supportEmail') ?? '').trim()
  const planPriceRaw = formData.get('planPrice')
  const planPrice = planPriceRaw ? Number(planPriceRaw) : 1599
  const multiBusinessPriceRaw = formData.get('multiBusinessPrice')
  const multiBusinessPrice = multiBusinessPriceRaw ? Number(multiBusinessPriceRaw) : 2599
  const planFeatures = String(formData.get('planFeatures') ?? '')
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)

  const supabase = await createClient()
  const { error } = await supabase
    .from('platform_settings')
    .update({
      easypaisa_number: easypaisaNumber || null,
      easypaisa_title: easypaisaTitle || null,
      easypaisa_note: easypaisaNote || null,
      jazzcash_number: jazzcashNumber || null,
      jazzcash_title: jazzcashTitle || null,
      jazzcash_note: jazzcashNote || null,
      bank_name: bankName || null,
      bank_account_title: bankAccountTitle || null,
      bank_account_number: bankAccountNumber || null,
      bank_iban: bankIban || null,
      bank_note: bankNote || null,
      support_email: supportEmail || null,
      plan_price: planPrice,
      multi_business_price: multiBusinessPrice,
      plan_features: planFeatures,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/dashboard/billing')
  return { success: true }
}
