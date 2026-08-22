import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { closeTicket } from '../actions'
import { ReplyForm } from '../ReplyForm'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  answered: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, subject, status, admin_last_read_at, organization:organizations(name)')
    .eq('id', id)
    .maybeSingle()

  if (!ticket) notFound()

  const org = (Array.isArray(ticket.organization) ? ticket.organization[0] : ticket.organization) as {
    name: string
  } | null

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
    (m) => !m.is_platform_admin && (!ticket.admin_last_read_at || m.created_at > ticket.admin_last_read_at)
  )
  if (hasUnread) {
    await supabase.rpc('mark_ticket_read', { p_ticket_id: id })
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/admin/support" className="text-sm text-zinc-500 underline">
        ← All tickets
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{ticket.subject}</h1>
          <p className="text-sm text-zinc-500">{org?.name ?? '—'}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[ticket.status] ?? 'bg-zinc-100 text-zinc-600'}`}
        >
          {ticket.status}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {(messages ?? []).map((m) => {
          const isSelf = m.is_platform_admin
          return (
            <div key={m.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  isSelf ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-800'
                }`}
              >
                <p className={`text-xs font-medium ${isSelf ? 'text-zinc-300' : 'text-zinc-400'}`}>
                  {isSelf ? 'You (support)' : 'Business owner'} · {m.created_at?.slice(0, 16).replace('T', ' ')}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          )
        })}
      </div>

      {ticket.status !== 'closed' && (
        <>
          <ReplyForm ticketId={ticket.id} />
          <form action={closeTicket} className="mt-3">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <button type="submit" className="text-sm text-zinc-500 underline">
              Close this ticket
            </button>
          </form>
        </>
      )}
    </div>
  )
}
