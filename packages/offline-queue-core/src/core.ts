import type { QueueItem, QueueItemKind, QueueStorageAdapter, ReplayResult, Replayer, SyncOutcome } from './types'

// No runtime APIs beyond core JS (no crypto, no fetch, no DOM) — the caller
// generates ids and timestamps and passes them in, so this file has nothing
// to mock in a unit test beyond a fake adapter and fake replay functions.

// A TypeError is the one consistent signal a failed fetch/network call
// produces across every webview engine (WebView2, WebKitGTK, WKWebView all
// surface it this way, though the exact message text differs per engine —
// match on the type, never the message).
//
// `rethrowFatal` is checked first and gets the final word: it's a hook a
// caller supplies to rethrow (not return a boolean for) any error that
// isn't really a failure at all — e.g. Next.js's redirect() rejects the
// same promise a network failure would, even though the request reached
// the server fine. A caller running inside Next.js supplies
// `unstable_rethrow` from 'next/navigation' here; this file has no idea
// what a "redirect" is and never needs to — if the hook throws, this
// function just lets that propagate instead of ever reaching the network
// check below.
export function classifyFailure(err: unknown, rethrowFatal?: (err: unknown) => void): 'network' | 'real' {
  rethrowFatal?.(err)
  if (err instanceof TypeError) return 'network'
  return 'real'
}

// Tries the real call; queues via the adapter only on a genuine network
// failure; anything else (a fatal error rethrown by `rethrowFatal`, or a
// normal validation rejection returned by the server) propagates completely
// unchanged, so a caller's existing error handling for the non-offline case
// needs no changes at all.
export async function tryOrQueue<T>(
  adapter: QueueStorageAdapter,
  item: Pick<QueueItem, 'id' | 'kind' | 'payload'>,
  realCall: () => Promise<T>,
  rethrowFatal?: (err: unknown) => void
): Promise<T | { queued: true; id: string }> {
  try {
    return await realCall()
  } catch (err) {
    if (classifyFailure(err, rethrowFatal) !== 'network') throw err
    await adapter.add({ ...item, queuedAt: new Date().toISOString(), attempts: 0 })
    return { queued: true, id: item.id }
  }
}

// Drains the queue in order. A replay succeeding (including a replayer's own
// "already applied" idempotency check reporting ok:true) removes the item. A
// thrown network failure during replay stops the whole drain immediately —
// if the network's down, every remaining item would fail the same way, so
// there's no point trying each one individually; they stay queued for the
// next sync attempt. A returned (not thrown) ok:false with permanent:true
// means the request reached the server and was genuinely rejected — e.g. the
// week got finalized while this was queued — moved to the conflict list
// instead of retried forever.
export async function syncQueue(adapter: QueueStorageAdapter, replayers: Record<QueueItemKind, Replayer>): Promise<SyncOutcome> {
  const items = await adapter.getAll()
  const synced: string[] = []
  const conflicts: SyncOutcome['conflicts'] = []

  for (const item of items) {
    let result: ReplayResult
    try {
      result = await replayers[item.kind](item.payload)
    } catch {
      break
    }

    if (result.ok) {
      await adapter.remove(item.id)
      synced.push(item.id)
    } else if (result.permanent) {
      await adapter.remove(item.id)
      conflicts.push({ id: item.id, kind: item.kind, message: result.message })
    } else {
      await adapter.update(item.id, { attempts: item.attempts + 1 })
    }
  }

  const remaining = (await adapter.getAll()).length
  return { synced, conflicts, remaining }
}
