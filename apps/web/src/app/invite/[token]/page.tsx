import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { acceptInvite } from './actions'

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const { error } = await searchParams
  const t = await getTranslations('invite')
  const tc = await getTranslations('common')

  const supabase = await createClient()

  const { data: previewRows } = await supabase.rpc('get_invitation_preview', {
    p_token: token,
  })
  const preview = previewRows?.[0] as
    | { organization_name: string; role: string; email: string; status: string; expires_at: string }
    | undefined

  const user = await getResilientUser(supabase)

  const next = `/invite/${token}`

  if (!preview) {
    return (
      <InviteShell heading={t('heading')}>
        <p className="text-sm text-zinc-600">{t('invalidLink')}</p>
      </InviteShell>
    )
  }

  const isExpired = new Date(preview.expires_at) < new Date()
  const isUsable = preview.status === 'pending' && !isExpired

  if (!isUsable) {
    return (
      <InviteShell heading={t('heading')}>
        <p className="text-sm text-zinc-600">
          {isExpired
            ? t('expired')
            : t('alreadyStatus', {
                status: preview.status === 'accepted' ? t('statusAccepted') : t('statusRevoked'),
              })}
        </p>
      </InviteShell>
    )
  }

  const roleLabel =
    preview.role === 'owner' ? tc('roleOwner') : preview.role === 'admin' ? tc('roleAdmin') : tc('roleStaff')

  return (
    <InviteShell heading={t('heading')}>
      <p className="text-sm text-zinc-600">
        {t.rich('invitedTo', {
          orgName: preview.organization_name,
          role: roleLabel,
          orgTag: (chunks) => <span className="font-medium">{chunks}</span>,
          roleTag: (chunks) => <span className="font-medium">{chunks}</span>,
        })}
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {user ? (
        <form action={acceptInvite} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t('acceptAs', { email: user.email ?? '' })}
          </button>
        </form>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(preview.email)}`}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t('createAccountToAccept')}
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-sm hover:bg-zinc-50"
          >
            {t('alreadyHaveAccount')}
          </Link>
        </div>
      )}
    </InviteShell>
  )
}

function InviteShell({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-2 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <LanguageSwitcher />
        </div>
        {children}
      </div>
    </div>
  )
}
