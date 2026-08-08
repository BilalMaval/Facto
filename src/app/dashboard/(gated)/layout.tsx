import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { getBillingState, isBlocked } from '@/lib/billing'
import { isPlatformAdmin } from '@/lib/platformAdmin'

export default async function GatedLayout({ children }: { children: React.ReactNode }) {
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')

  const billing = getBillingState(membership.organization)

  if (isBlocked(billing.status) && !(await isPlatformAdmin())) {
    const copy: Record<string, { title: string; body: string; cta: string }> = {
      pending: {
        title: `Welcome to ${membership.organization.name}`,
        body: 'Choose a plan to get started — start a free 3-day trial or activate now.',
        cta: 'Choose your plan',
      },
      trial_expired: {
        title: 'Your free trial has ended',
        body: `Activate your plan to keep using ${membership.organization.name}.`,
        cta: 'Go to Billing',
      },
      suspended: {
        title: 'Account suspended',
        body:
          billing.suspensionNote ||
          `Access to ${membership.organization.name} has been suspended for non-payment.`,
        cta: 'Go to Billing',
      },
    }
    const { title, body, cta } = copy[billing.status] ?? copy.suspended
    const borderClass = billing.status === 'pending' ? 'border-zinc-200' : 'border-red-200'

    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16 text-center">
        <div className={`max-w-md rounded-lg border ${borderClass} bg-white p-8 shadow-sm`}>
          <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
          <p className="mt-2 text-sm text-zinc-500">{body}</p>
          <Link
            href="/dashboard/billing"
            className="mt-5 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {cta}
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
