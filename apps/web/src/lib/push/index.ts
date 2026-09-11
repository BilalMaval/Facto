import { isTauri, isCapacitor } from '@/lib/offlineQueue'

// Called once on mount from PushNotificationInit.tsx. Android registers for
// FCM push; Desktop kicks off an update check (its notifications are handled
// separately by DesktopNotificationListener.tsx, since those are driven by
// Realtime events, not a one-shot init call). A plain browser tab does
// nothing either way.
export async function initPush() {
  if (isCapacitor()) {
    const { registerAndroidPush } = await import('./androidRegister')
    await registerAndroidPush()
  } else if (isTauri()) {
    const { checkForDesktopUpdate } = await import('./desktopUpdater')
    await checkForDesktopUpdate()
  }
}
