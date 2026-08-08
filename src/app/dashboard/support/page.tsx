import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { NewTicketForm } from './NewTicketForm'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  answered: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

export default async function SupportPage() {
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') redirect('/dashboard')

  const supabase = await createClient()
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, subject, status, created_at, updated_at')
    .eq('organization_id', membership.organization.id)
    .order('updated_at', { ascending: false })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
      <p className="mt-1 text-sm text-zinc-500">Send questions to the platform team.</p>

      <div className="mt-6">
        <NewTicketForm organizationId={membership.organization.id} />
      </div>

      {tickets && tickets.length > 0 ? (
        <div className="mt-8 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white shadow-sm">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/support/${t.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900">{t.subject}</p>
                <p className="text-xs text-zinc-400">Updated {t.updated_at?.slice(0, 10)}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status] ?? 'bg-zinc-100 text-zinc-600'}`}
              >
                {t.status}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-zinc-400">No tickets yet.</p>
      )}
    </div>
  )
}
