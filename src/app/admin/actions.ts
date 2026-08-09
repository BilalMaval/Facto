'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: boolean } | null

export async function updateOrganizationBilling(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const orgId = String(formData.get('orgId') ?? '')
  const subscriptionStatus = String(formData.get('subscriptionStatus') ?? '').trim()
  const monthlyFeeRaw = formData.get('monthlyFee')
  const monthlyFee = monthlyFeeRaw !== null && monthlyFeeRaw !== '' ? Number(monthlyFeeRaw) : null
  const billingNotes = String(formData.get('billingNotes') ?? '').trim()

  if (!orgId) {
    return { error: 'Missing organization' }
  }

  const supabase = await createClient()
  // The generated RPC arg types don't reflect that these Postgres params are
  // nullable (coalesced server-side) — cast to bypass that codegen gap.
  const { error } = await supabase.rpc('update_organization_billing', {
    p_org_id: orgId,
    p_subscription_status: subscriptionStatus || null,
    p_monthly_fee: monthlyFee,
    p_billing_notes: billingNotes || null,
  } as unknown as Parameters<typeof supabase.rpc<'update_organization_billing'>>[1])

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin')
  revalidatePath(`/admin/organizations/${orgId}`)
  return { success: true }
}

const HIDABLE_TABS = ['billing', 'support', 'settings'] as const

export async function setHiddenTabs(_prevState: FormState, formData: FormData): Promise<FormState> {
  const orgId = String(formData.get('orgId') ?? '')
  if (!orgId) {
    return { error: 'Missing organization' }
  }
  const hiddenTabs = HIDABLE_TABS.filter((key) => formData.get(key) === 'on')

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_set_hidden_tabs', {
    p_org_id: orgId,
    p_hidden_tabs: hiddenTabs,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin')
  revalidatePath(`/admin/organizations/${orgId}`)
  return { success: true }
}

export async function renameOrganization(_prevState: FormState, formData: FormData): Promise<FormState> {
  const orgId = String(formData.get('orgId') ?? '')
  const name = String(formData.get('name') ?? '').trim()

  if (!orgId) {
    return { error: 'Missing organization' }
  }
  if (!name) {
    return { error: 'Name cannot be empty' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_rename_organization', { p_org_id: orgId, p_name: name })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin')
  revalidatePath(`/admin/organizations/${orgId}`)
  return { success: true }
}

export async function adjustBillingDates(_prevState: FormState, formData: FormData): Promise<FormState> {
  const orgId = String(formData.get('orgId') ?? '')
  const subscribedAt = String(formData.get('subscribedAt') ?? '').trim()
  const paidUntil = String(formData.get('paidUntil') ?? '').trim()
  const suspensionNote = String(formData.get('suspensionNote') ?? '').trim()

  if (!orgId) {
    return { error: 'Missing organization' }
  }

  const supabase = await createClient()
  // Same codegen gap as update_organization_billing above — these Postgres
  // params are nullable but generated types don't reflect that.
  const { error } = await supabase.rpc('admin_adjust_billing_dates', {
    p_org_id: orgId,
    p_subscribed_at: subscribedAt || null,
    p_paid_until: paidUntil || null,
    p_suspension_note: suspensionNote || null,
  } as unknown as Parameters<typeof supabase.rpc<'admin_adjust_billing_dates'>>[1])

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin')
  revalidatePath(`/admin/organizations/${orgId}`)
  return { success: true }
}
