import type { QueueItem, QueueStorageAdapter } from '@facto/offline-queue-core'

// The only file in this app allowed to import anything Tauri-specific.
// @tauri-apps/plugin-store is loaded dynamically, never as a static
// top-level import — a plain browser tab (no Tauri) and Next's SSR pass
// (Node, no window) must never even try to load this module's dependency.
const STORE_FILE = 'offline-queue.json'
const QUEUE_KEY = 'items'

async function getStore() {
  const { Store } = await import('@tauri-apps/plugin-store')
  return Store.load(STORE_FILE)
}

async function readItems(store: Awaited<ReturnType<typeof getStore>>): Promise<QueueItem[]> {
  return (await store.get<QueueItem[]>(QUEUE_KEY)) ?? []
}

export const tauriStoreAdapter: QueueStorageAdapter = {
  async getAll() {
    const store = await getStore()
    return readItems(store)
  },

  async add(item) {
    const store = await getStore()
    const items = await readItems(store)
    items.push(item)
    await store.set(QUEUE_KEY, items)
    await store.save()
  },

  async remove(id) {
    const store = await getStore()
    const items = await readItems(store)
    await store.set(
      QUEUE_KEY,
      items.filter((i) => i.id !== id)
    )
    await store.save()
  },

  async update(id, patch) {
    const store = await getStore()
    const items = await readItems(store)
    await store.set(
      QUEUE_KEY,
      items.map((i) => (i.id === id ? { ...i, ...patch } : i))
    )
    await store.save()
  },
}
