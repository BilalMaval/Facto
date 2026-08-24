import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'

const ACTIVE_ORG_COOKIE = 'active_org_id'

type Organization = {
  id: string
  name: string
  week_start_day: 'monday' | 'saturday'
  week_scheme_previous_start_day: 'monday' | 'saturday' | null
  week_scheme_transition_date: string | null
  timezone: string
  currency: string
  date_format: string
  show_decimals: boolean
  standard_days_per_week: number
  standard_hours_per_day: number
  overtime_rate_multiplier: number
  subscription_status: string
  trial_ends_at: string | null
  subscribed_at: string | null
  paid_until: string | null
  suspension_note: string | null
  monthly_fee: number | null
  hidden_nav_tabs: string[]
}

type MembershipResult = {
  user: NonNullable<Awaited<ReturnType<typeof getResilientUser>>>
  membership: { role: string; organization: Organization } | undefined
  memberships: { organizationId: string; orgName: string; role: string }[]
  parentOrganizationId: string | null
}

// Keyed per user, updated on every successful lookup. Supabase running
// locally alongside this server (Desktop phase) can go down and come back
// up without the Next.js process restarting — when that happens mid-session,
// a query failure must not look like "this user genuinely has zero
// memberships" (see below), and the only data available to fall back to is
// whatever this process already fetched successfully before Supabase dropped.
//
// Hung off globalThis rather than a plain module-level const: Next.js dev
// (Turbopack) compiles each route into its own bundle, and a route can end
// up with its own separate instance of this module — a plain `const` here
// would silently give /dashboard and /dashboard/entries two unrelated Maps,
// so a cache populated by one route would look empty from another. globalThis
// is the one thing every bundle instance in the same process actually shares
// — confirmed necessary empirically, not just defensive.
const globalForMembershipCache = globalThis as unknown as {
  __membershipLastKnownGood?: Map<string, MembershipResult>
}
const lastKnownGood =
  globalForMembershipCache.__membershipLastKnownGood ??
  (globalForMembershipCache.__membershipLastKnownGood = new Map<string, MembershipResult>())

export const getCurrentMembership = cache(async function getCurrentMembership() {
  const supabase = await createClient()

  const user = await getResilientUser(supabase)

  if (!user) {
    return { user: null, membership: null, memberships: [], parentOrganizationId: null, membershipLookupFailed: false }
  }

  const { data: rows, error } = await supabase
    .from('memberships')
    .select(
      'role, organization:organizations(id, name, week_start_day, week_scheme_previous_start_day, week_scheme_transition_date, timezone, currency, date_format, show_decimals, standard_days_per_week, standard_hours_per_day, overtime_rate_multiplier, subscription_status, trial_ends_at, subscribed_at, paid_until, suspension_note, monthly_fee, hidden_nav_tabs)'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    // Can't tell from a failed query whether this user has an org or not —
    // that's very different from a genuine zero-row result, and must not
    // send an already-onboarded user back through /onboarding just because
    // Supabase was unreachable for this one request.
    const cached = lastKnownGood.get(user.id)
    if (cached) return { ...cached, user, membershipLookupFailed: true }
    return { user, membership: null, memberships: [], parentOrganizationId: null, membershipLookupFailed: true }
  }

  if (!rows || rows.length === 0) {
    const result = { user, membership: null, memberships: [], parentOrganizationId: null, membershipLookupFailed: false }
    lastKnownGood.delete(user.id)
    return result
  }

  const normalized = rows.map((row) => {
    const orgRaw = row.organization as unknown
    const organization = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as Organization
    return { role: row.role as string, organization }
  })

  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
  const active = normalized.find((m) => m.organization.id === activeOrgId) ?? normalized[0]

  // The earliest org this user owns — billing (payments, transaction
  // history) is centralized here, since 2nd+ businesses are auto-active
  // under the owner's Premium plan and never carry their own subscription.
  const parentOrganizationId = normalized.find((m) => m.role === 'owner')?.organization.id ?? null

  const result: MembershipResult = {
    user,
    membership: active,
    memberships: normalized.map((m) => ({
      organizationId: m.organization.id,
      orgName: m.organization.name,
      role: m.role,
    })),
    parentOrganizationId,
  }
  lastKnownGood.set(user.id, result)
  return { ...result, membershipLookupFailed: false }
})
