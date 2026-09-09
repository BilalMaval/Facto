import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { countUnreadByTicket } from '@/lib/support'
import { formatDate, type DateFormat } from '@/lib/dates'
import { NewTicketForm } from './NewTicketForm'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  answered: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

export default async function SupportPage() {
  const t = await getTranslations('support')
  const locale = await getLocale()
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') redirect('/dashboard')

  const dateFormat = membership.organization.date_format as DateFormat
  const supabase = await createClient()
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, subject, status, created_at, updated_at, org_last_read_at')
    .eq('organization_id', membership.organization.id)
    .order('updated_at', { ascending: false })

  const ticketIds = (tickets ?? []).map((t) => t.id)
  const { data: messages } = ticketIds.length
    ? await supabase
        .from('support_ticket_messages')
        .select('ticket_id, is_platform_admin, created_at')
        .in('ticket_id', ticketIds)
    : { data: [] as { ticket_id: string; is_platform_admin: boolean; created_at: string }[] }

  // Unread = replies from the admin that arrived after this owner last
  // opened the thread — one badge per unseen reply, gone once they view it.
  const lastReadByTicket = new Map((tickets ?? []).map((t) => [t.id, t.org_last_read_at]))
  const unreadByTicket = countUnreadByTicket(
    (messages ?? []).filter((m) => m.is_platform_admin),
    lastReadByTicket
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p>

      <div className="mt-6">
        <NewTicketForm organizationId={membership.organization.id} />
      </div>

      {tickets && tickets.length > 0 ? (
        <div className="mt-8 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white shadow-sm">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/support/${ticket.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{ticket.subject}</p>
                  <p className="text-xs text-zinc-400">
                    {ticket.updated_at ? t('updatedLabel', { date: formatDate(ticket.updated_at.slice(0, 10), dateFormat, locale) }) : '—'}
                  </p>
                </div>
                {(unreadByTicket.get(ticket.id) ?? 0) > 0 && (
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                    {(unreadByTicket.get(ticket.id) ?? 0) > 9 ? '9+' : unreadByTicket.get(ticket.id)}
                  </span>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status] ?? 'bg-zinc-100 text-zinc-600'}`}
              >
                {ticket.status === 'open'
                  ? t('statusOpen')
                  : ticket.status === 'answered'
                    ? t('statusAnswered')
                    : ticket.status === 'closed'
                      ? t('statusClosed')
                      : ticket.status}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-zinc-400">{t('noneYet')}</p>
      )}
    </div>
  )
}
