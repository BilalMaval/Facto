'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: boolean } | null

function friendlyMessage(error: { code?: string; message: string }) {
  if (error.code === '23505') {
    return 'This email already has a pending invitation.'
  }
  return error.message
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
  const orgId = String(formData.get('organizationId') ?? '')
  const email = String(formData.get('email') ?? '').trim()
  const role = String(formData.get('role') ?? '')

  if (!email || (role !== 'admin' && role !== 'staff')) {
    return { error: 'Enter a valid email and role' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_invitation', {
    p_org_id: orgId,
    p_email: email,
    p_role: role,
  })

  if (error) {
    return { error: friendlyMessage(error) }
  }

  revalidatePath('/dashboard/team')
  return { success: true }
}

export async function revokeInvite(formData: FormData) {
  const invitationId = String(formData.get('invitationId') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_invitation', {
    p_invitation_id: invitationId,
  })

  if (error) {
    redirect(`/dashboard/team?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/team')
}

// Owner-only — RLS also enforces this, this is just a clean error message
// instead of a silent no-op.
export async function removeMember(formData: FormData) {
  const organizationId = String(formData.get('organizationId') ?? '')
  const userId = String(formData.get('userId') ?? '')

  const supabase = await createClient()
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  if (error) {
    redirect(`/dashboard/team?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/team')
}

// Any non-owner member can leave their own business whenever they want.
export async function leaveOrganization(formData: FormData) {
  const organizationId = String(formData.get('organizationId') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.rpc('leave_organization', { p_org_id: organizationId })

  if (error) {
    redirect(`/dashboard/team?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}
