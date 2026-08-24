'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function switchActiveOrganization(formData: FormData) {
  const organizationId = String(formData.get('organizationId') ?? '')
  const supabase = await createClient()

  const user = await getResilientUser(supabase)
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!membership) redirect('/dashboard')

  const cookieStore = await cookies()
  cookieStore.set('active_org_id', organizationId, { path: '/', httpOnly: true, sameSite: 'lax' })

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}
