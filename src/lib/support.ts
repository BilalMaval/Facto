// Shared by both support ticket lists and the owner-side nav badge: counts
// messages from the OTHER side that arrived after this viewer's last-read
// timestamp for that ticket — one notification per unseen reply, per ticket.
export function countUnreadByTicket(
  messages: { ticket_id: string; created_at: string }[],
  lastReadByTicket: Map<string, string | null>
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const m of messages) {
    const lastRead = lastReadByTicket.get(m.ticket_id)
    if (!lastRead || m.created_at > lastRead) {
      counts.set(m.ticket_id, (counts.get(m.ticket_id) ?? 0) + 1)
    }
  }
  return counts
}
