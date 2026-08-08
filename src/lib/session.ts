import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const ACTIVE_ORG_COOKIE = 'active_org_id'

type Organization = {
  id: string
  name: string
  week_start_day: 'monday' | 'saturday'
  subscription_status: string
  trial_ends_at: string | null
  subscribed_at: string | null
  paid_until: string | null
  suspension_note: string | null
  monthly_fee: number | null
  hidden_nav_tabs: string[]
}

export const getCurrentMembership = cache(async function getCurrentMembership() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, membership: null, memberships: [] }
  }

  const { data: rows } = await supabase
    .from('memberships')
    .select(
      'role, organization:organizations(id, name, week_start_day, subscription_status, trial_ends_at, subscribed_at, paid_until, suspension_note, monthly_fee, hidden_nav_tabs)'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (!rows || rows.length === 0) {
    return { user, membership: null, memberships: [] }
  }

  const normalized = rows.map((row) => {
    const orgRaw = row.organization as unknown
    const organization = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as Organization
    return { role: row.role as string, organization }
  })

  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
  const active = normalized.find((m) => m.organization.id === activeOrgId) ?? normalized[0]

  return {
    user,
    membership: active,
    memberships: normalized.map((m) => ({
      organizationId: m.organization.id,
      orgName: m.organization.name,
      role: m.role,
    })),
  }
})
