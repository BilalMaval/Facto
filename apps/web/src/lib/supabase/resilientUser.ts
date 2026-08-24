import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { isBreakerOpen, openBreaker } from '@/lib/supabase/timeoutFetch'

// getUser() always makes a real network call to Auth — the right behavior
// when it succeeds or genuinely rejects a session, since it's the one check
// that can't be spoofed by a tampered cookie. But when Auth itself is
// unreachable (Supabase down, offline), it fails with a *retryable* fetch
// error, not a real "invalid session" verdict — every getUser() call site in
// this app used to treat those two cases identically, force-logging-out an
// already-authenticated user just because Auth couldn't be reached to
// double-check them.
//
// Falls back to the locally cached session in exactly that one case.
// getSession() reads the session straight from the cookie and only needs the
// network if the access token has actually expired.
//
// The timeout below is doing real work, not just being defensive: traced
// this to @supabase/auth-js's _refreshAccessToken, which retries a failed
// token refresh with its own exponential backoff (200ms, 400ms, 800ms...)
// for up to ~25-30s before giving up — confirmed empirically against local
// Supabase with its containers removed. That's baked into the library for
// legitimate transient-blip resilience, but it means a plain `await
// getUser()` can block for the better part of 30s before this function ever
// gets a chance to fall back — "usable while offline" requires not waiting
// that long, so both calls race against a short timeout of our own here,
// above the library's own retry loop rather than trying to shorten
// individual fetches inside it.
const TIMEOUT_MS = 3000
const TIMED_OUT = Symbol('resilientUser: timed out')

// Deliberately shorter than timeoutFetch.ts's own internal timeout: that
// module's timer only opens its breaker when IT fires, but this race here
// always wins first (3s < 5s) and moves on, abandoning the fetch before the
// inner timer gets a chance — so without the explicit openBreaker() calls
// below, the breaker would only end up set by an orphaned timer firing on
// its own schedule, well after this function (and whatever queries follow
// it in the same request) already decided what to do. Confirmed empirically:
// without this, a page whose first call is auth still paid the full cost of
// every subsequent query before falling back.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
  } catch {
    return null
  }
})()

async function withTimeout<T>(promise: Promise<T>): Promise<T | typeof TIMED_OUT> {
  return Promise.race([
    promise,
    new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), TIMEOUT_MS)),
  ])
}

// Schema-agnostic on purpose — only touches .auth, so it accepts both the
// typed (SupabaseClient<Database>) and untyped clients already in use
// across this app (middleware.ts's client isn't schema-typed today).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getResilientUser(supabase: SupabaseClient<any, any, any>) {
  // Already known unreachable moments ago (this request or a very recent
  // one) — skip straight to the cached session instead of paying another
  // full timeout just to rediscover what we already know.
  if (SUPABASE_ORIGIN && isBreakerOpen(SUPABASE_ORIGIN)) {
    const sessionResult = await withTimeout(supabase.auth.getSession())
    if (sessionResult === TIMED_OUT) return null
    return sessionResult.data.session?.user ?? null
  }

  const userResult = await withTimeout(supabase.auth.getUser())

  if (userResult !== TIMED_OUT) {
    const { data, error } = userResult
    if (data.user) return data.user
    // A real (non-retryable) rejection — genuinely not authenticated.
    if (!(error && isAuthRetryableFetchError(error))) return null
  } else if (SUPABASE_ORIGIN) {
    openBreaker(SUPABASE_ORIGIN)
  }

  // Either a retryable connectivity failure or our own timeout — both mean
  // "couldn't verify with the server," so fall back to the locally cached
  // session instead of concluding "not authenticated."
  const sessionResult = await withTimeout(supabase.auth.getSession())
  if (sessionResult === TIMED_OUT) return null
  return sessionResult.data.session?.user ?? null
}
