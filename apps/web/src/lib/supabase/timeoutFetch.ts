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
// module's, deliberately — see its comment) can check the breaker before
// deciding whether to even attempt getUser(), without making a fetch call
// itself. Takes a plain origin string (e.g. from NEXT_PUBLIC_SUPABASE_URL)
// rather than a request for that reason.
export function isBreakerOpen(origin: string): boolean {
  return (breakerOpenUntil.get(origin) ?? 0) > Date.now()
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
    // cache: 'no-store' opts this out of Next's dev-mode Data Cache fetch
    // instrumentation, on general principle — didn't turn out to be what
    // was making fetches slow here, but there's no reason for Server
    // Component data fetches to go through cache bookkeeping regardless.
    const fetchPromise = fetch(input, { ...init, signal, cache: 'no-store' })

    // The real fetch's eventual outcome updates the breaker — including
    // after our own timeout below has already given up and moved on. A
    // late success clears it: this file's own top comment already
    // established that AbortSignal.timeout() doesn't reliably cancel the
    // underlying request in this dev environment, so an "abandoned" fetch
    // keeps running for real, and fetches issued from inside this dev
    // server can genuinely take longer than DEFAULT_TIMEOUT_MS even while
    // Supabase is fully healthy (measured 5.9–9.2s against a target that
    // answered a plain curl in 626ms) — an earlier version discarded that
    // late success entirely, so the breaker could stay open indefinitely
    // long after the real outage ended, waiting for a "fast enough" probe
    // that might never come.
    //
    // A late REJECTION only opens the breaker if it's a genuine network
    // failure, not an AbortError — when the signal *does* manage to cancel
    // the request (confirmed it sometimes does, inconsistently, matching
    // "doesn't *reliably* cancel" rather than "never"), that rejection
    // means "we gave up on it," not "the server refused it," and treating
    // our own cancellation as proof of an outage was reopening the breaker
    // right back up through this exact path even after the fix above.
    fetchPromise.then(
      () => breakerOpenUntil.delete(key),
      (err) => {
        if (err?.name !== 'AbortError') breakerOpenUntil.set(key, Date.now() + BREAKER_COOLDOWN_MS)
      }
    )
    fetchPromise.catch(() => {}) // never let the abandoned attempt surface as an unhandled rejection

    return Promise.race([
      fetchPromise,
      new Promise<Response>((_, reject) => {
        setTimeout(() => {
          // Deliberately does NOT touch the breaker. Exceeding our own
          // patience isn't evidence of an outage — confirmed empirically
          // that fetches from inside this dev server can genuinely take
          // 5.9-9.2s while Supabase is fully healthy and answers a plain
          // curl in under a second. This only bounds how long *this
          // caller* waits; the abandoned fetch keeps running for real and
          // its actual outcome (the .then() above) is the only thing
          // allowed to open or clear the breaker. A genuine outage doesn't
          // need this branch to catch it either — a truly stopped Supabase
          // fails fast (~70ms, connection refused, see top comment), so
          // the real rejection arrives well before this timer would fire.
          reject(timeoutError("Can't reach the server — check your connection and try again."))
        }, timeoutMs)
      }),
    ])
  }
}
