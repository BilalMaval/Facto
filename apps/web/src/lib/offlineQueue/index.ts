import type { QueueStorageAdapter } from '@facto/offline-queue-core'

// Relies on tauri.conf.json's withGlobalTauri: true, which injects this
// global only inside the Tauri shell — a plain browser tab never has it.
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

// IndexedDB is also present inside the Tauri webview (it's a real browser
// engine under the hood), so this is only ever consulted once isTauri() has
// already said no — otherwise Desktop would end up on the Web adapter
// instead of its own native store.
function isBrowserWithIndexedDb(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

let cachedAdapter: QueueStorageAdapter | null | undefined

// null = no adapter for this platform yet (a future Mobile/Capacitor build
// before its own adapter exists, or a server-side render pass) — queuing
// simply doesn't activate, callers fall through to normal online-only
// behavior.
export async function getAdapter(): Promise<QueueStorageAdapter | null> {
  if (cachedAdapter !== undefined) return cachedAdapter
  if (isTauri()) {
    const { tauriStoreAdapter } = await import('./adapters/tauriStore')
    cachedAdapter = tauriStoreAdapter
  } else if (isBrowserWithIndexedDb()) {
    const { indexedDbAdapter } = await import('./adapters/indexedDbStore')
    cachedAdapter = indexedDbAdapter
  } else {
    cachedAdapter = null
  }
  return cachedAdapter
}
