import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentMembership } from '@/lib/session'
import { getBillingState } from '@/lib/billing'
import { DashboardNav } from './DashboardNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, membership, memberships } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')

  const billing = getBillingState(membership.organization)

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <DashboardNav
        orgName={membership.organization.name}
        role={membership.role}
        userEmail={user.email ?? ''}
        hiddenTabs={membership.organization.hidden_nav_tabs}
        memberships={memberships}
        activeOrgId={membership.organization.id}
      />
      {billing.status === 'grace' && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 print:hidden">
          Payment overdue — access will be suspended in {billing.daysRemaining} day
          {billing.daysRemaining === 1 ? '' : 's'} unless you pay.{' '}
          <Link href="/dashboard/billing" className="font-medium underline">
            Pay now
          </Link>
        </div>
      )}
      <main className="flex-1">{children}</main>

      {billing.status === 'trial' && billing.daysRemaining !== null && (
        <Link
          href="/dashboard/billing"
          className="fixed right-5 top-28 z-30 flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-800 shadow-lg hover:bg-blue-100 print:hidden"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          Free trial — {billing.daysRemaining} day{billing.daysRemaining === 1 ? '' : 's'} left
        </Link>
      )}
    </div>
  )
}
