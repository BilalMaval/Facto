import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()

  const user = await getResilientUser(supabase)

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

  const t = await getTranslations('auth.onboarding')

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('heading')}</h1>
            <p className="mt-1 text-sm text-zinc-500">{t('description')}</p>
          </div>
          <LanguageSwitcher />
        </div>

        <OnboardingForm />
      </div>
    </div>
  )
}
