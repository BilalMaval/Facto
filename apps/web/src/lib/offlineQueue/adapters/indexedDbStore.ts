import type { QueueItem, QueueStorageAdapter } from '@facto/offline-queue-core'

// The Web persistence adapter — a plain browser tab, no Tauri. IndexedDB is
// the only browser-native storage with no practical size ceiling (unlike
// localStorage's ~5MB synchronous string-only store) and survives page
// reloads/browser restarts the same way the Tauri store adapter survives
// app restarts.
//
// No external package needed, and unlike @tauri-apps/plugin-store this
// module is imported statically from index.ts — `indexedDB` is a standard
// browser global, not a dependency that needs keeping out of a non-Tauri or
// server bundle. The functions below only touch `indexedDB` when actually
// called, never at module-eval time, so importing this file during Next's
// SSR pass (where `indexedDB` doesn't exist) stays safe.

const DB_NAME = 'facto-offline-queue'
const DB_VERSION = 1
const STORE_NAME = 'items'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return dbPromise
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
        const request = run(store)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
  )
}

export const indexedDbAdapter: QueueStorageAdapter = {
  async getAll() {
    return withStore<QueueItem[]>('readonly', (store) => store.getAll())
  },

  async add(item) {
    await withStore('readwrite', (store) => store.add(item))
  },

  async remove(id) {
    await withStore('readwrite', (store) => store.delete(id))
  },

  // Single read-modify-write transaction (not a separate get() then a
  // separate put() call) so a concurrent update to the same item can't land
  // between them and get silently clobbered — IndexedDB transactions are
  // atomic across multiple requests as long as they share one transaction,
  // which this does.
  async update(id, patch) {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
      const getRequest = store.get(id)
      getRequest.onerror = () => reject(getRequest.error)
      getRequest.onsuccess = () => {
        const existing = getRequest.result as QueueItem | undefined
        if (!existing) {
          resolve()
          return
        }
        const putRequest = store.put({ ...existing, ...patch })
        putRequest.onerror = () => reject(putRequest.error)
        putRequest.onsuccess = () => resolve()
      }
    })
  },
}
