import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { getOwnerTier } from '@/lib/ownerPlan'
import { NewBusinessForm } from './NewBusinessForm'

export default async function NewBusinessPage() {
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') redirect('/dashboard')

  const tier = await getOwnerTier(user.id)
  if (tier !== 'premium') redirect('/dashboard/settings/upgrade')

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div>
          <Link href="/dashboard/settings" className="text-sm text-zinc-500 underline">
            ← Settings
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Add another business</h1>
          <p className="mt-1 text-sm text-zinc-500">
            You&apos;ll be the owner and can set it up the same way you did the first one.
          </p>
        </div>

        <NewBusinessForm />
      </div>
    </div>
  )
}
