'use client'

import { useEffect } from 'react'

// Mounted once per layout (dashboard/admin), alongside RealtimeRefresh —
// kicks off Android push registration / Desktop update check. No-op on a
// plain browser tab (see lib/push/index.ts's platform checks).
export function PushNotificationInit() {
  useEffect(() => {
    import('@/lib/push').then(({ initPush }) => void initPush())
  }, [])

  return null
}
