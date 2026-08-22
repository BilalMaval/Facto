import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminFilterBar } from '../AdminFilterBar'
import { countUnreadByTicket } from '@/lib/support'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  answered: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'answered', label: 'Answered' },
  { value: 'closed', label: 'Closed' },
]

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string }>
}) {
  const { q = '', status = '', from = '', to = '' } = await searchParams
  const supabase = await createClient()
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, subject, status, created_at, updated_at, admin_last_read_at, organization:organizations(name)')
    .order('updated_at', { ascending: false })

  const ticketIds = (tickets ?? []).map((t) => t.id)
  const { data: messages } = ticketIds.length
    ? await supabase
        .from('support_ticket_messages')
        .select('ticket_id, body, is_platform_admin, created_at')
        .in('ticket_id', ticketIds)
    : { data: [] as { ticket_id: string; body: string; is_platform_admin: boolean; created_at: string }[] }

  const bodiesByTicket = new Map<string, string>()
  for (const m of messages ?? []) {
    bodiesByTicket.set(m.ticket_id, `${bodiesByTicket.get(m.ticket_id) ?? ''} ${m.body}`)
  }

  // Unread = messages from the business owner's side that arrived after
  // this admin last opened the thread — disappears once they view it.
  const lastReadByTicket = new Map((tickets ?? []).map((t) => [t.id, t.admin_last_read_at]))
  const unreadByTicket = countUnreadByTicket(
    (messages ?? []).filter((m) => !m.is_platform_admin),
    lastReadByTicket
  )

  let rows = (tickets ?? []).map((t) => {
    const org = (Array.isArray(t.organization) ? t.organization[0] : t.organization) as {
      name: string
    } | null
    return {
      ...t,
      orgName: org?.name ?? '—',
      messageText: bodiesByTicket.get(t.id) ?? '',
      unreadCount: unreadByTicket.get(t.id) ?? 0,
    }
  })

  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter((r) => {
      const haystack = [r.subject, r.orgName, r.status, r.created_at?.slice(0, 10) ?? '', r.messageText]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }
  if (status) rows = rows.filter((r) => r.status === status)
  if (from) rows = rows.filter((r) => (r.created_at?.slice(0, 10) ?? '') >= from)
  if (to) rows = rows.filter((r) => (r.created_at?.slice(0, 10) ?? '') <= to)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Support tickets</h1>
      <p className="mt-1 text-sm text-zinc-500">Queries from business owners across all organizations.</p>

      <div className="mt-6">
        <AdminFilterBar
          basePath="/admin/support"
          q={q}
          searchPlaceholder="Search anything — subject, organization, status, message text…"
          selects={[{ name: 'status', value: status, options: STATUS_OPTIONS }]}
          dateRange={{ fromParam: 'from', toParam: 'to', fromValue: from, toValue: to }}
        />
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-400">No tickets match.</p>
      ) : (
        <div className="mt-6 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white shadow-sm">
          {rows.map((t) => (
            <Link
              key={t.id}
              href={`/admin/support/${t.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{t.subject}</p>
                  <p className="text-xs text-zinc-400">
                    {t.orgName} · updated {t.updated_at?.slice(0, 10)}
                  </p>
                </div>
                {t.unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                    {t.unreadCount > 9 ? '9+' : t.unreadCount}
                  </span>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status] ?? 'bg-zinc-100 text-zinc-600'}`}
              >
                {t.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
