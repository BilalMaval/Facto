import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SignupForm } from './SignupForm'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>
}) {
  const { next, email } = await searchParams
  const t = await getTranslations('auth.signup')

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('heading')}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {next?.startsWith('/invite/') ? t('subtitleInvite') : t('subtitleDefault')}
            </p>
          </div>
          <LanguageSwitcher />
        </div>

        <SignupForm next={next ?? ''} prefillEmail={email} />

        <p className="text-center text-sm text-zinc-500">
          {t('alreadyHaveAccount')}{' '}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-zinc-900 underline"
          >
            {t('logInLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}
