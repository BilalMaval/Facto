import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { isBreakerOpen } from '@/lib/supabase/timeoutFetch'

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

// Deliberately shorter than timeoutFetch.ts's own internal timeout — this
// race always wins first (3s < 5s) and moves on, abandoning the fetch
// rather than waiting out auth-js's own much longer retry loop. Used to
// also call openBreaker() itself on that bail, on the theory that without
// it the breaker would only ever get set by an orphaned timer firing later.
// Removed that: bailing at just 3s is an even more trigger-happy version of
// the same mistake timeoutFetch.ts's own setTimeout branch made — treating
// "we got impatient" as "confirmed down," when fetches from inside this dev
// server can genuinely take 5.9-9.2s while Supabase is fully healthy. The
// abandoned getUser() fetch still runs through fetchWithTimeout underneath,
// so its real eventual outcome still reaches the shared breaker on its own
// — this just stops a merely-slow response from prematurely opening it and
// fast-rejecting every other query on the page for the next 10s.
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
  }

  // Either a retryable connectivity failure or our own timeout — both mean
  // "couldn't verify with the server," so fall back to the locally cached
  // session instead of concluding "not authenticated."
  const sessionResult = await withTimeout(supabase.auth.getSession())
  if (sessionResult === TIMED_OUT) return null
  return sessionResult.data.session?.user ?? null
}
