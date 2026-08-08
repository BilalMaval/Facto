import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { getOwnerTier } from '@/lib/ownerPlan'
import { switchActiveOrganization } from '../../actions'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage() {
  const { user, membership, memberships } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') redirect('/dashboard')

  const org = membership.organization
  const tier = await getOwnerTier(user.id)
  const addBusinessHref = tier === 'premium' ? '/dashboard/settings/new-business' : '/dashboard/settings/upgrade'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">Organization-wide settings for {org.name}.</p>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-700">Your businesses</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {tier === 'premium'
            ? 'Multi-business access is enabled — manage as many businesses as you need.'
            : 'You can currently manage one business. Unlock multi-business access to add more.'}
        </p>

        <div className="mt-4 space-y-2">
          {memberships.map((m) => (
            <div
              key={m.organizationId}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900">{m.orgName}</p>
                <p className="text-xs text-zinc-500">{m.role}</p>
              </div>
              {m.organizationId === org.id ? (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
                  Current
                </span>
              ) : (
                <form action={switchActiveOrganization}>
                  <input type="hidden" name="organizationId" value={m.organizationId} />
                  <button type="submit" className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900">
                    Switch
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <Link
          href={addBusinessHref}
          className="mt-4 inline-block rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          + Add another business
        </Link>
      </div>

      <div className="mt-6">
        <SettingsForm organizationId={org.id} currentWeekStartDay={org.week_start_day} />
      </div>
    </div>
  )
}
