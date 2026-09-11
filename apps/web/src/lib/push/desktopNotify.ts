// The only file in this app allowed to import anything
// @tauri-apps/plugin-notification-specific. Dynamically imported, never a
// static top-level import — same reasoning as adapters/tauriStore.ts.
export async function sendDesktopNotification(title: string, body: string) {
  const { isPermissionGranted, requestPermission, sendNotification } = await import(
    '@tauri-apps/plugin-notification'
  )

  let granted = await isPermissionGranted()
  if (!granted) {
    const permission = await requestPermission()
    granted = permission === 'granted'
  }
  if (!granted) return

  sendNotification({ title, body })
}
