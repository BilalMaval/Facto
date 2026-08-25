import { useSyncExternalStore } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { tryOrQueue, syncQueue, type QueueItemKind, type Replayer, type ReplayResult } from '@facto/offline-queue-core'
import { createEntry, createPayment, type FormState } from '@/app/dashboard/(gated)/entries/actions'
import { saveAttendanceDay } from '@/app/dashboard/(gated)/slips/actions'
import { getAdapter } from './index'

// ---- status store (no external state library, matching this app's
// convention — a plain module-level pub-sub read via useSyncExternalStore) ----

export type QueueStatus = {
  online: boolean
  pending: number
  syncing: boolean
  conflicts: { id: string; kind: QueueItemKind; message: string }[]
  // Bumped exactly once per confirmed offline→online transition (never on
  // mount, never on a re-render) — the one signal OfflineQueueBanner needs
  // to call router.refresh() reliably, without re-deriving "did online just
  // flip true" from `online` itself and risking a stale/duplicate trigger.
  reconnectedAt: number
}

let status: QueueStatus = { online: true, pending: 0, syncing: false, conflicts: [], reconnectedAt: 0 }
const listeners = new Set<() => void>()

function setStatus(patch: Partial<QueueStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

export function subscribeStatus(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getStatusSnapshot() {
  return status
}

// Only ever meaningfully called from a 'use client' component (the banner)
// — useSyncExternalStore itself is safe to import here regardless.
export function useOfflineQueueStatus(): QueueStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot, getStatusSnapshot)
}

async function refreshPendingCount() {
  const adapter = await getAdapter()
  if (!adapter) return
  const items = await adapter.getAll()
  setStatus({ pending: items.length })
}

// ---- replayers: the only place that knows how to turn a queued payload
// back into a real call to the real Server Actions ----

function formDataFrom(payload: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(payload)) fd.set(key, value)
  return fd
}

async function replayFormAction(
  call: (prevState: FormState, formData: FormData) => Promise<FormState>,
  payload: Record<string, string>
): Promise<ReplayResult> {
  try {
    const result = await call(null, formDataFrom(payload))
    // A network-level failure (see FormState.networkError) means the server
    // is still unreachable during this sync attempt — not a real rejection
    // — so it must stop the drain and stay queued for next time, the same
    // as any other thrown network failure here, not get treated as a
    // permanent conflict.
    if (result?.networkError) throw new TypeError(result.error ?? 'Network error')
    if (result?.error) return { ok: false, permanent: true, message: result.error }
    return { ok: true }
  } catch (err) {
    // Session expired while this sat queued — nothing to redirect to during
    // a background sync, so surface it as a conflict instead of silently
    // retrying forever (which is what letting this propagate would cause,
    // since syncQueue treats any thrown error as "network failure, stop").
    // unstable_rethrow rethrows only if err is a Next.js internal
    // control-flow error (redirect/notFound/etc.) — createEntry/
    // createPayment only ever call redirect('/login'), so catching it here
    // specifically means "the session expired."
    try {
      unstable_rethrow(err)
    } catch {
      return { ok: false, permanent: true, message: 'Not signed in — sign in again, then sync.' }
    }
    throw err
  }
}

const replayers: Record<QueueItemKind, Replayer> = {
  entry: (payload) => replayFormAction(createEntry, payload),
  payment: (payload) => replayFormAction(createPayment, payload),
  attendance: async (payload) => {
    const result = await saveAttendanceDay({
      organizationId: payload.organizationId,
      workerId: payload.workerId,
      attendanceDate: payload.attendanceDate,
      status: payload.status as 'present' | 'absent' | 'half_day' | 'holiday',
      overtimeHours: Number(payload.overtimeHours) || 0,
      overtimeWage: payload.overtimeWage === '' ? null : Number(payload.overtimeWage),
      holidayWage: Number(payload.holidayWage) || 0,
    })
    // See the matching check in replayFormAction — still unreachable during
    // this sync attempt, so stop the drain instead of recording a conflict.
    if (result.networkError) throw new TypeError(result.error ?? 'Network error')
    if (result.error) return { ok: false, permanent: true, message: result.error }
    return { ok: true }
  },
}

// ---- sync trigger ----

export async function syncNow() {
  const adapter = await getAdapter()
  if (!adapter) return
  setStatus({ syncing: true })
  const outcome = await syncQueue(adapter, replayers)
  setStatus({
    syncing: false,
    pending: outcome.remaining,
    conflicts: [...status.conflicts, ...outcome.conflicts],
  })
}

export function dismissConflict(id: string) {
  setStatus({ conflicts: status.conflicts.filter((c) => c.id !== id) })
}

// navigator.onLine only reflects the OS network adapter — stopping local
// Supabase (Docker down, or just `supabase stop`) never touches that, so
// the browser's online/offline events never fire for exactly the outage
// this whole feature exists to survive. This is what actually answers "is
// Supabase reachable right now": any response at all (even a 404/401 —
// this isn't checking the response is successful, just that a server
// answered) means reachable; a fetch that never gets a response at all
// (connection refused, DNS failure, timeout) means it isn't.
async function probeReachable(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return true
  try {
    await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    return true
  } catch {
    return false
  }
}

const REACHABILITY_POLL_MS = 5000

let initialized = false

// Called once from OfflineQueueBanner's mount effect — sets up
// reachability tracking (both the fast, event-driven browser signal and
// the slower but authoritative poll against Supabase itself) and picks up
// any items still queued from a previous session.
export function initOfflineQueue() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  setStatus({ online: navigator.onLine })

  function markReachable(reachable: boolean) {
    const wasOffline = !status.online
    setStatus({ online: reachable, ...(reachable && wasOffline ? { reconnectedAt: Date.now() } : {}) })
    // Only worth trying once we've actually reached the server again —
    // attempting mid-outage would just re-pay the same failure syncQueue
    // already handles gracefully (stop the drain, stay queued).
    if (reachable && wasOffline) void syncNow()
  }

  // Fast path: a real network-adapter change (wifi off, laptop closed) —
  // no reason to wait out a poll tick for something the browser already
  // told us instantly.
  window.addEventListener('online', () => void probeReachable().then(markReachable))
  window.addEventListener('offline', () => setStatus({ online: false }))

  // Authoritative path: catches "the OS network is fine but Supabase
  // itself is down" — the scenario the events above can't see at all.
  // Runs continuously, not just while believed offline, since `online`
  // being true here doesn't guarantee it's still true a moment from now.
  setInterval(() => void probeReachable().then(markReachable), REACHABILITY_POLL_MS)

  void refreshPendingCount()
}

// ---- the three wrapped call sites ----

export async function wrappedCreateEntry(prevState: FormState, formData: FormData): Promise<FormState> {
  const adapter = await getAdapter()
  if (!adapter) return createEntry(prevState, formData)

  const clientId = crypto.randomUUID()
  formData.set('clientId', clientId) // also carried on the live attempt, so a lost-response retry stays idempotent too
  const payload = Object.fromEntries(formData.entries()) as Record<string, string>

  const result = await tryOrQueue(
    adapter,
    { id: clientId, kind: 'entry', payload },
    async () => {
      const r = await createEntry(prevState, formData)
      // Supabase's client swallows a fetch failure into a normal { error }
      // return instead of throwing — networkError flags that case so it can
      // be turned back into a real throw here, which is what tryOrQueue's
      // classifyFailure actually looks for to decide whether to queue it.
      if (r?.networkError) throw new TypeError(r.error ?? 'Network error')
      return r
    },
    unstable_rethrow
  )
  if (result && 'queued' in result) {
    void refreshPendingCount()
    return { success: true, queued: true }
  }
  return result
}

export async function wrappedCreatePayment(prevState: FormState, formData: FormData): Promise<FormState> {
  const adapter = await getAdapter()
  if (!adapter) return createPayment(prevState, formData)

  const clientId = crypto.randomUUID()
  formData.set('clientId', clientId)
  const payload = Object.fromEntries(formData.entries()) as Record<string, string>

  const result = await tryOrQueue(
    adapter,
    { id: clientId, kind: 'payment', payload },
    async () => {
      const r = await createPayment(prevState, formData)
      if (r?.networkError) throw new TypeError(r.error ?? 'Network error')
      return r
    },
    unstable_rethrow
  )
  if (result && 'queued' in result) {
    void refreshPendingCount()
    return { success: true, queued: true }
  }
  return result
}

export async function wrappedSaveAttendanceDay(
  input: Parameters<typeof saveAttendanceDay>[0]
): Promise<{ error?: string; queued?: boolean }> {
  const adapter = await getAdapter()
  if (!adapter) return saveAttendanceDay(input)

  const id = crypto.randomUUID()
  const payload: Record<string, string> = {
    organizationId: input.organizationId,
    workerId: input.workerId,
    attendanceDate: input.attendanceDate,
    status: input.status,
    overtimeHours: String(input.overtimeHours),
    overtimeWage: input.overtimeWage == null ? '' : String(input.overtimeWage),
    holidayWage: String(input.holidayWage),
  }

  const result = await tryOrQueue(adapter, { id, kind: 'attendance', payload }, async () => {
    const r = await saveAttendanceDay(input)
    if (r.networkError) throw new TypeError(r.error ?? 'Network error')
    return r
  })
  if ('queued' in result) {
    void refreshPendingCount()
    return { queued: true }
  }
  return result
}
