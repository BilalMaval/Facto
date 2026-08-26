import type { QueueStorageAdapter } from '@facto/offline-queue-core'

// Relies on tauri.conf.json's withGlobalTauri: true, which injects this
// global only inside the Tauri shell — a plain browser tab never has it.
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

// window.Capacitor is injected by the native runtime itself inside the
// Capacitor shell (apps/mobile) — isNativePlatform() is false in a plain
// browser tab (including this same web app previewed outside the native
// shell), so this can't be satisfied by anything other than the real
// Android/iOS app. No import needed here, same reasoning as isTauri() —
// only the adapter itself (adapters/capacitorStore.ts) touches the
// Capacitor package.
export function isCapacitor(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Capacitor' in window &&
    typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform === 'function' &&
    (window as unknown as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor.isNativePlatform()
  )
}

// IndexedDB is also present inside the Tauri and Capacitor webviews (both
// are real browser engines under the hood), so this is only ever consulted
// once isTauri() and isCapacitor() have already said no — otherwise Desktop
// or Mobile would end up on the Web adapter instead of their own native
// store.
function isBrowserWithIndexedDb(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

let cachedAdapter: QueueStorageAdapter | null | undefined

// null = no adapter for this platform (a server-side render pass) — queuing
// simply doesn't activate, callers fall through to normal online-only
// behavior.
export async function getAdapter(): Promise<QueueStorageAdapter | null> {
  if (cachedAdapter !== undefined) return cachedAdapter
  if (isTauri()) {
    const { tauriStoreAdapter } = await import('./adapters/tauriStore')
    cachedAdapter = tauriStoreAdapter
  } else if (isCapacitor()) {
    const { capacitorStoreAdapter } = await import('./adapters/capacitorStore')
    cachedAdapter = capacitorStoreAdapter
  } else if (isBrowserWithIndexedDb()) {
    const { indexedDbAdapter } = await import('./adapters/indexedDbStore')
    cachedAdapter = indexedDbAdapter
  } else {
    cachedAdapter = null
  }
  return cachedAdapter
}
