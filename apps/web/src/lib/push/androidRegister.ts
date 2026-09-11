import { saveDeviceToken } from '@/app/actions/pushTokens'

// The only file in this app allowed to import anything
// @capacitor/push-notifications-specific. Dynamically imported, never a
// static top-level import — a plain browser tab and Next's SSR pass must
// never touch it. Each call does its own `await import(...)` and calls
// straight through rather than returning the plugin object from a shared
// helper — see adapters/capacitorStore.ts's comment on why an extra layer
// of async-function return breaks a Capacitor plugin proxy (its "then"
// property answers to anything, including being awaited itself).
export async function registerAndroidPush() {
  const { PushNotifications } = await import('@capacitor/push-notifications')

  const { receive } = await PushNotifications.requestPermissions()
  if (receive !== 'granted') return

  await PushNotifications.addListener('registration', ({ value: token }) => {
    void saveDeviceToken(token)
  })
  await PushNotifications.addListener('registrationError', (err) => {
    console.error('Push registration failed', err)
  })

  await PushNotifications.register()
}
