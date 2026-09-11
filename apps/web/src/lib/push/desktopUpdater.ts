// The only file in this app allowed to import anything
// @tauri-apps/plugin-updater/plugin-process-specific. Dynamically imported,
// never a static top-level import — same reasoning as adapters/tauriStore.ts.
// Called once on app start (see index.ts); silently no-ops on any failure —
// a failed update check must never block using the app.
export async function checkForDesktopUpdate() {
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update) return

    await update.downloadAndInstall()

    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch (err) {
    console.error('Desktop update check failed', err)
  }
}
