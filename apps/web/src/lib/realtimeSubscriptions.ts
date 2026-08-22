export type RealtimeSubscription = { table: string; filter?: string }

// Tables scoped to organization_id (or, for `organizations` itself, its own
// id) are filtered to the current org, so a business owner's session only
// refreshes on changes that could actually affect what they're looking at
// — not on every other tenant's activity. `support_ticket_messages` (no
// organization_id column — only ticket_id) and the low-volume global/
// per-owner tables stay unfiltered.
export function orgScopedSubscriptions(organizationId: string): RealtimeSubscription[] {
  const scoped = [
    'memberships',
    'invitations',
    'workers',
    'work_codes',
    'work_entries',
    'payments',
    'weekly_slips',
    'support_tickets',
    'payment_submissions',
  ]
  return [
    { table: 'organizations', filter: `id=eq.${organizationId}` },
    ...scoped.map((table) => ({ table, filter: `organization_id=eq.${organizationId}` })),
    { table: 'support_ticket_messages' },
    { table: 'owner_plans' },
    { table: 'platform_settings' },
    { table: 'platform_admins' },
  ]
}

// The platform admin genuinely needs visibility into everything, across
// every organization — no filtering.
export const ADMIN_SUBSCRIPTIONS: RealtimeSubscription[] = [
  'organizations',
  'memberships',
  'invitations',
  'workers',
  'work_codes',
  'work_entries',
  'payments',
  'weekly_slips',
  'support_tickets',
  'support_ticket_messages',
  'payment_submissions',
  'owner_plans',
  'platform_settings',
  'platform_admins',
].map((table) => ({ table }))
