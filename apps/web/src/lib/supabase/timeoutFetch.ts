// Neither the platform default nor @supabase/auth-js apply any timeout to
// the fetch calls behind .auth.getUser()/getSession() or PostgREST queries.
// Confirmed empirically this took real investigation to pin down: a raw
// Node fetch to a stopped local Supabase fails in ~70ms, but the identical
// request made from inside the Next.js dev server took 25+ seconds — and an
// AbortSignal.timeout() passed through init.signal did not shorten that at
// all. Next.js's dev-mode fetch patching (for its Data Cache instrumentation)
// doesn't reliably honor an incoming abort signal. So this doesn't rely on
// the signal being respected — it races the real fetch against an
// independent timer and simply stops waiting on the loser, regardless of
// what the underlying fetch implementation does with the abort signal.
// The abandoned fetch is left to resolve/reject in the background; its
// result is discarded and any rejection is swallowed so it can't surface as
// an unhandled rejection.
//
// Applied to the whole client (not just auth), since a hung PostgREST call
// during a write action needs to fail fast too, for the offline queue's
// tryOrQueue to actually catch it promptly rather than sit frozen first.
const DEFAULT_TIMEOUT_MS = 5000

// A single page render can fire several independent queries against the
// same Supabase instance (e.g. entries/page.tsx: workers, work codes,
// entries, payments — on top of the membership lookup above it in the tree).
// Without this, each one pays the full DEFAULT_TIMEOUT_MS independently
// before giving up, and they compound into double-digit seconds for one
// page load during an outage — confirmed empirically (14-21s to render
// dashboard/entries with Supabase stopped). Once one call to a given host
// has timed out, later calls to that same host fail fast for a short
// cooldown instead of each re-paying the same wait, then automatically
// probe again for real once the cooldown lapses — a normal circuit-breaker
// shape, without needing separate "half-open" bookkeeping: the very next
// call after the cooldown just is that probe, and clears the breaker itself
// on success.
//
// Keyed by origin, not global, so an outage on one host (e.g. local
// Supabase) doesn't fast-fail requests to an unrelated one.
//
// Hung off globalThis rather than a plain module-level const for the same
// reason as the membership cache in session.ts: Next.js dev (Turbopack)
// compiles each route into its own bundle, and a plain top-level Map here
// would silently fragment into multiple unrelated breakers per route.
const BREAKER_COOLDOWN_MS = 10000

const globalForBreaker = globalThis as unknown as {
  __fetchTimeoutBreaker?: Map<string, number>
}
const breakerOpenUntil =
  globalForBreaker.__fetchTimeoutBreaker ?? (globalForBreaker.__fetchTimeoutBreaker = new Map())

function originKey(input: RequestInfo | URL): string {
  try {
    const url = typeof input === 'string' || input instanceof URL ? input : input.url
    return new URL(url).origin
  } catch {
    return 'unknown'
  }
}

// Exposed so resilientUser.ts's own outer timeout (shorter than this
// module's, deliberately — see its comment) can consult and contribute to
// the same breaker directly, rather than relying on this module's internal
// timer to fire on its own schedule after the outer race has already moved
// on. Takes a plain origin string (e.g. from NEXT_PUBLIC_SUPABASE_URL)
// rather than a request, since the caller isn't making a fetch call itself.
export function isBreakerOpen(origin: string): boolean {
  return (breakerOpenUntil.get(origin) ?? 0) > Date.now()
}

export function openBreaker(origin: string): void {
  breakerOpenUntil.set(origin, Date.now() + BREAKER_COOLDOWN_MS)
}

// This rejection has two independent readers that each need a different
// signal from it, and it has to satisfy both at once:
//
// 1. @supabase/postgrest-js retries GET/HEAD/OPTIONS requests itself — up to
//    3 times with its own 1s/2s/4s backoff — on top of whatever this wrapper
//    does, unless the error it catches has `.name === 'AbortError'` (it
//    checks that explicitly to avoid retrying a deliberately cancelled
//    request). Confirmed empirically: without this, every query during an
//    outage took ~7s — exactly 1+2+4 — regardless of how fast this wrapper
//    itself rejected, because postgrest-js kept re-trying it anyway.
// 2. packages/offline-queue-core's classifyFailure() — deliberately
//    platform-agnostic, so it can't know about postgrest-js's convention —
//    decides "queue this locally" by checking `err instanceof TypeError`,
//    the one signal a failed fetch produces consistently across every
//    webview engine. A plain DOMException satisfies (1) but fails this
//    check, which silently broke offline queuing during a real outage:
//    the write surfaced as a raw error instead of being saved locally.
//
// A DOMException can't be both (its own class, not a TypeError subclass),
// so this is a small custom class instead — extends TypeError to satisfy
// classifyFailure, sets .name to satisfy postgrest-js.
class TimeoutAbortError extends TypeError {
  constructor(message: string) {
    super(message)
    this.name = 'AbortError'
  }
}

function timeoutError(message: string): TypeError {
  return new TimeoutAbortError(message)
}

export function fetchWithTimeout(timeoutMs = DEFAULT_TIMEOUT_MS): typeof fetch {
  return (input, init) => {
    const key = originKey(input)
    const openUntil = breakerOpenUntil.get(key) ?? 0
    if (openUntil > Date.now()) {
      // This message can reach the UI verbatim on a non-queued write action
      // (e.g. entries/actions.ts's `return { error: error.message }`) —
      // worth being presentable, not just accurate.
      return Promise.reject(timeoutError("Can't reach the server — check your connection and try again."))
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal
    const fetchPromise = fetch(input, { ...init, signal })
    fetchPromise.catch(() => {}) // never let the abandoned attempt surface as an unhandled rejection

    let settledByTimeout = false
    const guardedFetch = fetchPromise.then(
      (response) => {
        if (!settledByTimeout) breakerOpenUntil.delete(key)
        return response
      },
      (err) => {
        if (!settledByTimeout) breakerOpenUntil.set(key, Date.now() + BREAKER_COOLDOWN_MS)
        throw err
      }
    )

    return Promise.race([
      guardedFetch,
      new Promise<Response>((_, reject) => {
        setTimeout(() => {
          settledByTimeout = true
          breakerOpenUntil.set(key, Date.now() + BREAKER_COOLDOWN_MS)
          reject(timeoutError("Can't reach the server — check your connection and try again."))
        }, timeoutMs)
      }),
    ])
  }
}
