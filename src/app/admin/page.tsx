import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getBillingState, deriveOrgPlan } from '@/lib/billing'
import { AdminFilterBar } from './AdminFilterBar'

// "Plan" and "Status" answer two different questions but stay consistent
// with each other:
//   - Plan (No Plan / Free Trial / Basic / Premium): a computed tier label
//     — never hand-typed, so it can't go stale. Premium reflects the
//     OWNER's multi-business entitlement (owner_plans), but only once THIS
//     org has itself started a trial or subscribed — a freshly created,
//     untouched org is 'No Plan' regardless of the owner's tier elsewhere.
//   - Status: this specific org's own subscription state, computed live
//     from its own billing dates. Approving a plan_upgrade (Premium)
//     payment now also activates the submitting org's own subscription,
//     so paying for Premium moves Status off Trial/Pending immediately —
//     see 20260101000020_activate_org_on_plan_upgrade.sql.
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Not started' },
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'grace', label: 'Grace' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'trial_expired', label: 'Trial expired' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PLAN_OPTIONS = [
  { value: '', label: 'All plans' },
  { value: 'No Plan', label: 'No Plan' },
  { value: 'Free Trial', label: 'Free Trial' },
  { value: 'Basic', label: 'Basic' },
  { value: 'Premium', label: 'Premium' },
]

const STATUS_LABELS: Record<string, string> = {
  pending: 'Not started',
  trial: 'Trial',
  active: 'Active',
  grace: 'Grace',
  suspended: 'Suspended',
  trial_expired: 'Trial expired',
  cancelled: 'Cancelled',
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string; from?: string; to?: string }>
}) {
  const { q = '', status = '', plan = '', from = '', to = '' } = await searchParams
  const supabase = await createClient()

  const { data: organizations } = await supabase
    .from('organizations')
    .select(
      'id, name, subscription_status, monthly_fee, week_start_day, created_at, trial_ends_at, subscribed_at, paid_until, suspension_note, hidden_nav_tabs'
    )
    .order('created_at', { ascending: false })

  const orgIds = (organizations ?? []).map((o) => o.id)

  const [{ data: ownerMemberships }, { data: ownerPlans }, { data: ownerEmails }] = await Promise.all([
    orgIds.length
      ? supabase.from('memberships').select('organization_id, user_id').eq('role', 'owner').in('organization_id', orgIds)
      : Promise.resolve({ data: [] as { organization_id: string; user_id: string }[] }),
    supabase.from('owner_plans').select('user_id, tier'),
    supabase.rpc('admin_list_org_owner_emails'),
  ])

  const tierByUser = new Map((ownerPlans ?? []).map((p) => [p.user_id, p.tier]))
  const multiBusinessByOrg = new Map<string, boolean>()
  for (const m of ownerMemberships ?? []) {
    if (tierByUser.get(m.user_id) === 'premium') multiBusinessByOrg.set(m.organization_id, true)
    else if (!multiBusinessByOrg.has(m.organization_id)) multiBusinessByOrg.set(m.organization_id, false)
  }

  const emailsByOrg = new Map<string, string[]>()
  for (const row of ownerEmails ?? []) {
    const list = emailsByOrg.get(row.organization_id) ?? []
    list.push(row.email)
    emailsByOrg.set(row.organization_id, list)
  }

  let rows = await Promise.all(
    (organizations ?? []).map(async (org) => {
      const [{ count: memberCount }, { count: workerCount }] = await Promise.all([
        supabase
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id),
        supabase
          .from('workers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id),
      ])
      return {
        ...org,
        memberCount: memberCount ?? 0,
        workerCount: workerCount ?? 0,
        liveStatus: getBillingState(org).status,
        planLabel: deriveOrgPlan(org.subscribed_at, org.trial_ends_at, multiBusinessByOrg.get(org.id) ?? false),
        ownerEmail: (emailsByOrg.get(org.id) ?? []).join(', ') || '—',
      }
    })
  )

  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter((r) => {
      const haystack = [
        r.name,
        r.ownerEmail,
        r.planLabel,
        r.liveStatus,
        r.monthly_fee != null ? Number(r.monthly_fee).toFixed(2) : '',
        r.created_at?.slice(0, 10) ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }
  if (status) rows = rows.filter((r) => r.liveStatus === status)
  if (plan) rows = rows.filter((r) => r.planLabel === plan)
  if (from) rows = rows.filter((r) => (r.created_at?.slice(0, 10) ?? '') >= from)
  if (to) rows = rows.filter((r) => (r.created_at?.slice(0, 10) ?? '') <= to)

  // Group each owner's businesses together — their oldest org is the
  // "parent", any later ones (created via multi-business/Premium) render
  // indented under it, instead of interleaved by raw creation date.
  const ownerIdByOrg = new Map((ownerMemberships ?? []).map((m) => [m.organization_id, m.user_id]))
  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = ownerIdByOrg.get(r.id) ?? r.id
    const group = groups.get(key)
    if (group) group.push(r)
    else groups.set(key, [r])
  }
  const orderedRows = [...groups.values()]
    .map((group) => [...group].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)))
    .sort((a, b) => (a[0].created_at < b[0].created_at ? 1 : a[0].created_at > b[0].created_at ? -1 : 0))
    .flatMap((group) => group.map((r, i) => ({ ...r, isChild: i > 0 })))

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Every business using the platform. Manage plan, subscription status, and fees per organization.
      </p>

      <div className="mt-6">
        <AdminFilterBar
          basePath="/admin"
          q={q}
          searchPlaceholder="Search anything — name, owner email, plan, status, fee, date…"
          selects={[
            { name: 'plan', value: plan, options: PLAN_OPTIONS },
            { name: 'status', value: status, options: STATUS_OPTIONS },
          ]}
          dateRange={{ fromParam: 'from', toParam: 'to', fromValue: from, toValue: to }}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Owner email</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Monthly fee</th>
              <th className="px-4 py-3 text-right">Members</th>
              <th className="px-4 py-3 text-right">Workers</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {!orderedRows.length && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-400">
                  No organizations match.
                </td>
              </tr>
            )}
            {orderedRows.map((org) => (
              <tr
                key={org.id}
                className={`border-b border-zinc-100 last:border-0 ${org.isChild ? 'bg-zinc-50/60' : ''}`}
              >
                <td className={`px-4 py-3 ${org.isChild ? 'pl-8 text-zinc-600' : 'font-medium text-zinc-900'}`}>
                  {org.isChild && <span className="mr-1.5 text-zinc-300">↳</span>}
                  {org.name}
                  {org.hidden_nav_tabs.length > 0 && (
                    <span className="ml-2 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {org.hidden_nav_tabs.length} tab{org.hidden_nav_tabs.length === 1 ? '' : 's'} hidden
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">{org.ownerEmail}</td>
                <td className="px-4 py-3">
                  <PlanBadge plan={org.planLabel} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={org.liveStatus} />
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">
                  {org.monthly_fee != null ? Number(org.monthly_fee).toFixed(2) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">{org.memberCount}</td>
                <td className="px-4 py-3 text-right text-zinc-600">{org.workerCount}</td>
                <td className="px-4 py-3 text-zinc-500">{org.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="font-medium text-zinc-900 underline hover:text-zinc-700"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    'No Plan': 'bg-zinc-100 text-zinc-500',
    'Free Trial': 'bg-blue-50 text-blue-700',
    Basic: 'bg-amber-50 text-amber-700',
    Premium: 'bg-purple-50 text-purple-700',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[plan] ?? 'bg-zinc-100 text-zinc-600'}`}>
      {plan}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-zinc-100 text-zinc-600',
    trial: 'bg-blue-50 text-blue-700',
    trial_expired: 'bg-red-50 text-red-700',
    grace: 'bg-amber-50 text-amber-700',
    suspended: 'bg-red-50 text-red-700',
    cancelled: 'bg-zinc-100 text-zinc-500',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-zinc-100 text-zinc-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
