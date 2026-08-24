// Zero imports from any platform (Tauri, IndexedDB, Next.js, DOM) — enforced by
// this package's own tsconfig, which has no "dom" in lib. This is what lets a
// Web (IndexedDB) or Mobile (Capacitor) storage adapter get added later without
// touching this file or core.ts at all.

export type QueueItemKind = 'entry' | 'payment' | 'attendance'

export type QueueItem = {
  id: string
  kind: QueueItemKind
  payload: Record<string, string>
  queuedAt: string
  attempts: number
}

// The one thing that differs per platform. A Tauri adapter (this phase),
// an IndexedDB adapter (Web/Mobile, later), or anything else just needs to
// satisfy this shape — core.ts never knows or cares which.
export interface QueueStorageAdapter {
  getAll(): Promise<QueueItem[]>
  add(item: QueueItem): Promise<void>
  remove(id: string): Promise<void>
  update(id: string, patch: Partial<QueueItem>): Promise<void>
}

// permanent: true means the request reached the server and was rejected for a
// reason that will never resolve by retrying (e.g. the week was finalized
// while offline) — the item moves to a conflict list instead of being retried.
// permanent: false is never actually returned by a replayer directly; a
// network failure during replay is a thrown exception instead (see
// syncQueue in core.ts), not a ReplayResult — this type only describes
// responses that genuinely reached the server.
export type ReplayResult = { ok: true } | { ok: false; permanent: boolean; message: string }

export type Replayer = (payload: Record<string, string>) => Promise<ReplayResult>

export type SyncOutcome = {
  synced: string[]
  conflicts: { id: string; kind: QueueItemKind; message: string }[]
  remaining: number
}
