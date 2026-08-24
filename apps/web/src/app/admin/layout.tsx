import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'
import { isPlatformAdmin } from '@/lib/platformAdmin'
import { RealtimeRefresh } from '@/components/RealtimeRefresh'
import { ADMIN_SUBSCRIPTIONS } from '@/lib/realtimeSubscriptions'
import { AdminNav } from './AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const user = await getResilientUser(supabase)

  if (!user) redirect('/login')
  if (!(await isPlatformAdmin())) redirect('/dashboard')

  // 'open' means a business owner sent a new ticket or message and is
  // waiting on the admin — surfaced across all organizations.
  const { count: openTicketCount } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <RealtimeRefresh subscriptions={ADMIN_SUBSCRIPTIONS} />
      <AdminNav userEmail={user.email ?? ''} supportBadgeCount={openTicketCount ?? 0} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
