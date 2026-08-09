import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { closeTicket, reopenTicket } from '../actions'
import { ReplyForm } from '../ReplyForm'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  answered: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') redirect('/dashboard')

  const supabase = await createClient()
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, subject, status, organization_id, org_last_read_at')
    .eq('id', id)
    .maybeSingle()

  if (!ticket || ticket.organization_id !== membership.organization.id) notFound()

  const { data: messages } = await supabase
    .from('support_ticket_messages')
    .select('id, body, is_platform_admin, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  // Only write when there's actually something new to mark — mark_ticket_read
  // itself updates support_tickets, which the realtime subscription would
  // otherwise pick back up and re-trigger this same page render in an
  // infinite loop (every render calling it again, forever).
  const hasUnread = (messages ?? []).some(
    (m) => m.is_platform_admin && (!ticket.org_last_read_at || m.created_at > ticket.org_last_read_at)
  )
  if (hasUnread) {
    await supabase.rpc('mark_ticket_read', { p_ticket_id: id })
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/dashboard/support" className="text-sm text-zinc-500 underline">
        ← All tickets
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{ticket.subject}</h1>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[ticket.status] ?? 'bg-zinc-100 text-zinc-600'}`}
        >
          {ticket.status}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {(messages ?? []).map((m) => {
          const isSelf = !m.is_platform_admin
          return (
            <div key={m.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  isSelf ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-800'
                }`}
              >
                <p className={`text-xs font-medium ${isSelf ? 'text-zinc-300' : 'text-zinc-400'}`}>
                  {isSelf ? 'You' : 'Support team'} · {m.created_at?.slice(0, 16).replace('T', ' ')}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          )
        })}
      </div>

      {ticket.status !== 'closed' ? (
        <>
          <ReplyForm ticketId={ticket.id} />
          <form action={closeTicket} className="mt-3">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <button type="submit" className="text-sm text-zinc-500 underline">
              Close this ticket
            </button>
          </form>
        </>
      ) : (
        <form action={reopenTicket} className="mt-4">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Reopen ticket
          </button>
        </form>
      )}
    </div>
  )
}
