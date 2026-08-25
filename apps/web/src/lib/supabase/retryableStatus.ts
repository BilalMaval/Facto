// Shared by every Server Action that reports FormState.networkError to the
// offline-queue wrapper (entries/actions.ts, slips/actions.ts) — status 0
// means the fetch itself never reached the server; a 5xx means it did reach
// PostgREST/Supabase but that layer couldn't process the request right now
// (confirmed in practice: PostgREST returns one right after Postgres
// restarts, while its schema cache is still reloading), which isn't a
// verdict on the write itself the way a 4xx is (e.g. a finalized week or a
// bad value). Treating a 5xx as a permanent rejection was a real bug:
// syncQueue moved a queued write into "permanent conflict" and discarded it
// over PostgREST not being ready yet, moments after Supabase came back up.
export function isRetryableStatus(status: number): boolean {
  return status === 0 || status >= 500
}
