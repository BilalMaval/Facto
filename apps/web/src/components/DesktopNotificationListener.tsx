'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isTauri } from '@/lib/offlineQueue'

type Props =
  | { variant: 'dashboard'; organizationId: string; currentUserId: string }
  | { variant: 'admin' }

// The Realtime-consuming counterpart to RealtimeRefresh.tsx — that
// component subscribes to the same tables but only ever triggers a
// router.refresh(), never reading the payload. This one reads it, to decide
// whether to fire a native Desktop notification via
// lib/push/desktopNotify.ts. A no-op everywhere except inside the Tauri
// shell (Android gets real push via FCM instead — see notify.ts).
//
// Invite-created has no Desktop equivalent: invitations RLS only grants
// select to the org's own owner/admin, so an invitee's session — the actual
// recipient — has no Realtime visibility into their own pending invite row
// (confirmed via supabase/migrations/20260101000003_rls.sql). Android
// doesn't have this problem since FCM sending is a server-initiated HTTP
// call, independent of the recipient's own session/RLS.
export function DesktopNotificationListener(props: Props) {
  const orgFilter = props.variant === 'dashboard' ? props.organizationId : undefined
  const currentUserId = props.variant === 'dashboard' ? props.currentUserId : undefined

  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      let ch = supabase.channel('desktop-notifications')

      // Unfiltered, matching realtimeSubscriptions.ts's own
      // support_ticket_messages entry — the table has no organization_id
      // column, so RLS (not a Postgres-changes filter) is what scopes each
      // connecting user to only the tickets they can actually see.
      ch = ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_ticket_messages' },
        (payload) => {
          const isPlatformAdminSender = (payload.new as { is_platform_admin?: boolean }).is_platform_admin
          const shouldNotify = props.variant === 'dashboard' ? isPlatformAdminSender === true : isPlatformAdminSender === false
          if (!shouldNotify) return
          void import('@/lib/push/desktopNotify').then(({ sendDesktopNotification }) =>
            sendDesktopNotification('New support message', 'You have a new reply on your support ticket.')
          )
        }
      )

      if (props.variant === 'dashboard' && orgFilter) {
        ch = ch.on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'payment_submissions', filter: `organization_id=eq.${orgFilter}` },
          (payload) => {
            const row = payload.new as { status?: string; submitted_by?: string }
            if (row.status === 'pending' || row.submitted_by !== currentUserId) return
            const approved = row.status === 'approved'
            void import('@/lib/push/desktopNotify').then(({ sendDesktopNotification }) =>
              sendDesktopNotification(
                approved ? 'Payment approved' : 'Payment rejected',
                approved ? 'Your submitted payment has been approved.' : 'Your submitted payment was rejected.'
              )
            )
          }
        )
      }

      ch.subscribe()
      channel = ch
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [props.variant, orgFilter, currentUserId])

  return null
}
