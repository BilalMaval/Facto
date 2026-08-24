import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'
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
      <InviteShell>
        <p className="text-sm text-zinc-600">This invitation link is invalid.</p>
      </InviteShell>
    )
  }

  const isExpired = new Date(preview.expires_at) < new Date()
  const isUsable = preview.status === 'pending' && !isExpired

  if (!isUsable) {
    return (
      <InviteShell>
        <p className="text-sm text-zinc-600">
          This invitation has {preview.status === 'pending' ? 'expired' : `already been ${preview.status}`}.
        </p>
      </InviteShell>
    )
  }

  return (
    <InviteShell>
      <p className="text-sm text-zinc-600">
        You&apos;ve been invited to join <span className="font-medium">{preview.organization_name}</span> as{' '}
        <span className="font-medium">{preview.role}</span>.
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
            Accept invite as {user.email}
          </button>
        </form>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(preview.email)}`}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800"
          >
            Create an account to accept
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-sm hover:bg-zinc-50"
          >
            I already have an account — log in
          </Link>
        </div>
      )}
    </InviteShell>
  )
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-2 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re invited</h1>
        {children}
      </div>
    </div>
  )
}
