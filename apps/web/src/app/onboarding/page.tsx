import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (membership) {
    redirect('/dashboard')
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Set up your factory</h1>
          <p className="mt-1 text-sm text-zinc-500">
            You&apos;ll be the owner of this organization and can invite your team next.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </div>
  )
}
