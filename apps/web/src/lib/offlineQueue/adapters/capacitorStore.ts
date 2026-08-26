import type { QueueItem, QueueStorageAdapter } from '@facto/offline-queue-core'

// The only file in this app allowed to import anything Capacitor-specific.
// @capacitor/preferences is loaded dynamically, never as a static top-level
// import — a plain browser tab (no Capacitor) and Next's SSR pass (Node, no
// window) must never even try to load this module's dependency. Mirrors
// adapters/tauriStore.ts conceptually, but each method inlines its own
// `await import(...)` rather than sharing a `getPreferences()` helper that
// returns the plugin object — confirmed by hitting it directly: passing a
// Capacitor plugin proxy through an extra layer of async-function return
// makes the caller's `await` treat the proxy as thenable (it answers to
// property access for literally any name, "then" included) and try to
// invoke a native/web method called "then", failing with `"Preferences.
// then()" is not implemented on web`. Every method here does its own
// `const { Preferences } = await import(...)` and calls straight through.
//
// IndexedDB is also genuinely available inside a Capacitor WebView (it's a
// real browser engine under the hood, same as Tauri's), so this adapter
// isn't required for correctness — but Preferences is Capacitor's own
// blessed, idiomatic cross-platform local-storage plugin, backed by
// SharedPreferences on Android and UserDefaults on iOS, rather than
// leaning on IndexedDB inside a native WebView, which has a track record of
// reliability quirks on some WebView versions. Matches index.ts's existing
// comment anticipating a dedicated Mobile/Capacitor adapter rather than
// falling through to the Web/IndexedDB one.
const STORE_KEY = 'facto-offline-queue'

export const capacitorStoreAdapter: QueueStorageAdapter = {
  async getAll() {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: STORE_KEY })
    return value ? (JSON.parse(value) as QueueItem[]) : []
  },

  async add(item) {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: STORE_KEY })
    const items: QueueItem[] = value ? JSON.parse(value) : []
    items.push(item)
    await Preferences.set({ key: STORE_KEY, value: JSON.stringify(items) })
  },

  async remove(id) {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: STORE_KEY })
    const items: QueueItem[] = value ? JSON.parse(value) : []
    await Preferences.set({
      key: STORE_KEY,
      value: JSON.stringify(items.filter((i) => i.id !== id)),
    })
  },

  async update(id, patch) {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: STORE_KEY })
    const items: QueueItem[] = value ? JSON.parse(value) : []
    await Preferences.set({
      key: STORE_KEY,
      value: JSON.stringify(items.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    })
  },
}
