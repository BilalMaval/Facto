import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBillingState, deriveOrgPlan } from '@/lib/billing'
import type { DateFormat } from '@/lib/dates'
import { BillingForm } from './BillingForm'
import { BillingCycleForm } from './BillingCycleForm'
import { VisibleTabsForm } from './VisibleTabsForm'
import { RenameOrgForm } from './RenameOrgForm'

const EFFECTIVE_STATUS_LABELS: Record<string, string> = {
  pending: 'Not started',
  trial: 'Trial',
  trial_expired: 'Trial expired',
  active: 'Active',
  grace: 'Payment overdue (grace)',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

export default async function AdminOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select(
      'id, name, subscription_status, monthly_fee, billing_notes, week_start_day, created_at, trial_ends_at, subscribed_at, paid_until, suspension_note, hidden_nav_tabs, date_format'
    )
    .eq('id', id)
    .maybeSingle()

  if (!org) notFound()

  const billing = getBillingState(org)

  const { data: members } = await supabase
    .from('memberships')
    .select('role, user_id')
    .eq('organization_id', id)

  const { count: workerCount } = await supabase
    .from('workers')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', id)

  const roleCounts = { owner: 0, admin: 0, staff: 0 }
  for (const m of members ?? []) {
    if (m.role in roleCounts) roleCounts[m.role as keyof typeof roleCounts]++
  }

  // Premium reflects the OWNER's multi-business entitlement (owner_plans),
  // but deriveOrgPlan only surfaces it once this org has itself started a
  // trial or subscribed — see the note on the Organizations list.
  const ownerIds = (members ?? []).filter((m) => m.role === 'owner').map((m) => m.user_id)
  const { data: ownerPlans } = ownerIds.length
    ? await supabase.from('owner_plans').select('tier').in('user_id', ownerIds)
    : { data: [] as { tier: string }[] }
  const multiBusinessEnabled = (ownerPlans ?? []).some((p) => p.tier === 'premium')
  const planLabel = deriveOrgPlan(org.subscribed_at, org.trial_ends_at, multiBusinessEnabled)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/admin" className="text-sm text-zinc-500 underline">
        ← All organizations
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{org.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Created {org.created_at?.slice(0, 10)} · Week type:{' '}
        {org.week_start_day === 'saturday' ? 'Saturday – Thursday' : 'Monday – Saturday'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Owners" value={roleCounts.owner} />
        <Stat label="Admins" value={roleCounts.admin} />
        <Stat label="Staff" value={roleCounts.staff} />
        <Stat label="Workers" value={workerCount ?? 0} />
      </div>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <p>
            Status:{' '}
            <span className="font-medium text-zinc-900">
              {EFFECTIVE_STATUS_LABELS[billing.status] ?? billing.status}
            </span>
          </p>
          <p>
            Plan: <span className="font-medium text-zinc-900">{planLabel}</span>
          </p>
          {(org.subscription_status === 'suspended' || org.subscription_status === 'cancelled') && (
            <p className="text-amber-700">
              Manually {org.subscription_status === 'suspended' ? 'suspended' : 'cancelled'} by admin
            </p>
          )}
          {billing.nextDueDate && <p className="text-zinc-500">Next due {billing.nextDueDate}</p>}
          {billing.graceEndsAt && <p className="text-zinc-500">Grace ends {billing.graceEndsAt}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <RenameOrgForm orgId={org.id} currentName={org.name} />
        <BillingForm org={org} />
        <BillingCycleForm org={org} dateFormat={org.date_format as DateFormat} />
        <VisibleTabsForm orgId={org.id} hiddenTabs={org.hidden_nav_tabs} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-semibold text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}
