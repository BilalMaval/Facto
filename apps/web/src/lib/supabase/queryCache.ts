// Reference-data lookups (workers, work codes) are what EntryForm,
// PaymentForm, and the attendance selector need just to render usable
// dropdowns — without them, "usable while offline" is theoretical: the user
// can see the page but has nothing to pick from, so there's nothing to queue.
// Unlike financial figures (payroll totals, recent entries), this is safe to
// serve from the last successful fetch: workers and work codes rarely change,
// and reusing a moments-stale list is a much smaller risk than the confusion
// of showing outdated money amounts as if they were current — so this is
// deliberately NOT used for anything computed or transactional.
//
// Hung off globalThis rather than a plain module-level const for the same
// reason as session.ts's membership cache: Next.js dev (Turbopack) compiles
// each route into its own bundle, and a plain top-level Map here would
// silently fragment into multiple unrelated caches per route.
const globalForQueryCache = globalThis as unknown as {
  __lastKnownGoodQueries?: Map<string, unknown>
}
const lastKnownGood =
  globalForQueryCache.__lastKnownGoodQueries ?? (globalForQueryCache.__lastKnownGoodQueries = new Map())

// Takes a thenable (a Supabase query builder, not yet awaited) rather than a
// plain async function, so a failed query can be told apart from a query
// that genuinely succeeded with an empty result — both have `error: null`,
// the only difference is a query never runs a second time here.
// `stale` distinguishes "the live query failed and this is a cached
// fallback" from "the live query genuinely succeeded" — most callers only
// destructure `data` and can ignore it, but a caller whose `data === null`
// result is ambiguous (SlipView's "worker not found" vs "can't reach the
// server") needs it to tell those apart correctly.
export async function withLastKnownGood<T>(
  key: string,
  query: PromiseLike<{ data: T | null; error: unknown }>
): Promise<{ data: T | null; stale: boolean }> {
  const { data, error } = await query
  if (!error) {
    lastKnownGood.set(key, data)
    return { data, stale: false }
  }
  return { data: lastKnownGood.has(key) ? (lastKnownGood.get(key) as T) : null, stale: true }
}
