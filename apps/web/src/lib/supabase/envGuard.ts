// Second, independent safety layer on top of the .env.development.local /
// .env.production.local split (see those files) — that split alone relies
// on Next.js's env-loading rules being followed correctly forever; this
// makes a mistake impossible to miss instead of just unlikely. Runs once
// per process (imported at module load, not per-request) in both
// src/lib/supabase/server.ts and client.ts, the only two places a Supabase
// client is ever constructed.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const isProductionRuntime = process.env.NODE_ENV === 'production'
const isLocalUrl = url.includes('127.0.0.1') || url.includes('localhost')

if (!isProductionRuntime && url && !isLocalUrl) {
  throw new Error(
    `Refusing to start: NODE_ENV is "${process.env.NODE_ENV}" (not production) but ` +
      `NEXT_PUBLIC_SUPABASE_URL is "${url}" — not a local Supabase instance. ` +
      `Local development must run against local Supabase (see .env.development.local; ` +
      `start it with "supabase start"). If this is deliberately a non-dev, non-prod run ` +
      `against a remote project, that's exactly the mistake this guard exists to catch.`
  )
}
