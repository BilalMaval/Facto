import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '../slips/ConfirmButton'
import { leaveOrganization, removeMember, revokeInvite } from './actions'
import { InviteLinkButton } from './InviteLinkButton'
import { InviteForm } from './InviteForm'

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')

  const org = membership.organization
  const canManage = membership.role === 'owner' || membership.role === 'admin'
  const isOwner = membership.role === 'owner'

  const supabase = await createClient()
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.rpc('list_org_members', { p_org_id: org.id }),
    canManage
      ? supabase
          .from('invitations')
          .select('id, email, role, status, created_at, token')
          .eq('organization_id', org.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; email: string; role: string; status: string; created_at: string; token: string }[] }),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {canManage ? `Invite admins or staff to ${org.name}.` : `Your team at ${org.name}.`}
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {canManage && <InviteForm organizationId={org.id} />}

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Team members</h2>
        {/* Owner isn't shown here — they're the business account, not a
            manageable team member (can't be removed or leave their own
            business). */}
        {!members?.some((m) => m.role !== 'owner') && (
          <p className="mt-2 text-sm text-zinc-400">No other team members yet.</p>
        )}
        <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white px-4 shadow-sm empty:border-0 empty:shadow-none">
          {members
            ?.filter((m) => m.role !== 'owner')
            .map((m) => {
              const isSelf = m.user_id === user.id
              const canRemove = isOwner && !isSelf
              const canLeave = isSelf
              return (
                <li key={m.user_id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {m.email}
                      {isSelf && <span className="ml-1 text-xs text-zinc-400">(you)</span>}
                    </p>
                    <p className="text-xs text-zinc-500">{m.role}</p>
                  </div>
                  {canRemove && (
                    <form action={removeMember}>
                      <input type="hidden" name="organizationId" value={org.id} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <ConfirmButton
                        confirmText={`Remove ${m.email} from ${org.name}? They'll lose access immediately.`}
                        className="text-sm text-red-600 underline hover:text-red-800"
                      >
                        Remove
                      </ConfirmButton>
                    </form>
                  )}
                  {canLeave && (
                    <form action={leaveOrganization}>
                      <input type="hidden" name="organizationId" value={org.id} />
                      <ConfirmButton
                        confirmText={`Leave ${org.name}? You'll lose access immediately.`}
                        className="text-sm text-red-600 underline hover:text-red-800"
                      >
                        Leave
                      </ConfirmButton>
                    </form>
                  )}
                </li>
              )
            })}
        </ul>
      </div>

      {canManage && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-zinc-500">Pending invitations</h2>
          {!invitations?.length && (
            <p className="mt-2 text-sm text-zinc-400">No pending invitations.</p>
          )}
          <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white px-4 shadow-sm empty:border-0 empty:shadow-none">
            {invitations?.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-zinc-500">{invite.role}</p>
                </div>
                <div className="flex items-center gap-4">
                  <InviteLinkButton token={invite.token} />
                  <form action={revokeInvite}>
                    <input type="hidden" name="invitationId" value={invite.id} />
                    <button
                      type="submit"
                      className="text-sm text-red-600 underline hover:text-red-800"
                    >
                      Revoke
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
