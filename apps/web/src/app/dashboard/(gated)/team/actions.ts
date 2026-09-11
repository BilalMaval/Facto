'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { notifyInviteCreated } from '@/lib/push/notify'

export type FormState = { error?: string; success?: boolean } | null

async function friendlyMessage(error: { code?: string; message: string }) {
  const t = await getTranslations()
  if (error.code === '23505') {
    return t('team.errors.pendingInvitationExists')
  }
  return t('common.genericError')
}

export async function checkInviteEmailAvailable(organizationId: string, email: string) {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return { available: true }

  const supabase = await createClient()
  const { data } = await supabase
    .from('invitations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('email', trimmed)
    .eq('status', 'pending')
    .maybeSingle()

  return { available: !data }
}

export async function inviteMember(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations('team.errors')
  const orgId = String(formData.get('organizationId') ?? '')
  const email = String(formData.get('email') ?? '').trim()
  const role = String(formData.get('role') ?? '')

  if (!email || (role !== 'admin' && role !== 'staff')) {
    return { error: t('invalidEmailRole') }
  }

  const supabase = await createClient()
  const { data: invitationId, error } = await supabase.rpc('create_invitation', {
    p_org_id: orgId,
    p_email: email,
    p_role: role,
  })

  if (error) {
    return { error: await friendlyMessage(error) }
  }

  after(() => notifyInviteCreated(invitationId))
  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function revokeInvite(formData: FormData) {
  const t = await getTranslations()
  const invitationId = String(formData.get('invitationId') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_invitation', {
    p_invitation_id: invitationId,
  })

  if (error) {
    redirect(`/dashboard/team?error=${encodeURIComponent(t('common.genericError'))}`)
  }

  revalidatePath('/dashboard/team')
}

// Owner-only — RLS also enforces this, this is just a clean error message
// instead of a silent no-op.
export async function removeMember(formData: FormData) {
  const t = await getTranslations()
  const organizationId = String(formData.get('organizationId') ?? '')
  const userId = String(formData.get('userId') ?? '')

  const supabase = await createClient()
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  if (error) {
    redirect(`/dashboard/team?error=${encodeURIComponent(t('common.genericError'))}`)
  }

  revalidatePath('/dashboard/team')
}

// Any non-owner member can leave their own business whenever they want.
export async function leaveOrganization(formData: FormData) {
  const t = await getTranslations()
  const organizationId = String(formData.get('organizationId') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.rpc('leave_organization', { p_org_id: organizationId })

  if (error) {
    redirect(`/dashboard/team?error=${encodeURIComponent(t('common.genericError'))}`)
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}
