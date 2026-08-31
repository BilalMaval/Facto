# Facto — Architecture & Flow

Multi-tenant factory payroll SaaS. Next.js 16 + Supabase, monorepo, three client shells (Web, Desktop/Tauri, Mobile/Capacitor) sharing one backend and one set of business-logic packages. Local-first development: no Vercel, `testing` branch for all work, `main` only touched with explicit authorization.

## Monorepo layout

```
apps/
  web/        Next.js 16 app — the actual application (Server Components,
              Server Actions, all business logic that isn't in a package)
  desktop/    Tauri 2 shell — thin native wrapper, no business logic
  mobile/     Capacitor 7 shell (Android + iOS scaffold) — thin native
              wrapper, no business logic
packages/
  payroll-core/         Pure payroll calculation logic (no platform imports)
  offline-queue-core/   Pure offline-queue contract (no platform imports)
supabase/
  migrations/  Full schema, RLS, functions, triggers — source of truth for
               both local (`supabase start`) and the linked production
               project
scripts/
  contract-test-payroll.ts  Diffs payroll-core's TS output against the
                            real finalize_weekly_slip() SQL function
```

**Governing rule** (confirmed as this project's standing workflow): the monorepo is the single source of truth. A change belongs in exactly one place — `apps/web` for app-specific logic, a `packages/*` package if it must be shared, a migration if it's schema/RLS/function, or native shell code only for genuinely platform-specific concerns (permissions, storage adapters, build config). Business logic is never duplicated across Web/Desktop/Mobile. Every change gets typecheck/lint/build run, and affected workflows tested. Production infrastructure and the production database are never touched without explicit authorization.

## Why Desktop and Mobile have almost no code ("Model A")

Both `apps/desktop` and `apps/mobile` are thin native shells whose WebView points at a **running Next.js server** (dev server locally, the eventual production deployment later) — not a bundled static export. This is required because the app depends on Server Actions and cookie-based sessions, which a static export can't serve. Desktop and Mobile therefore don't run their own copy of any business logic; they just render the same web app and share the offline-queue package via a platform-specific storage adapter.

## Payroll (`packages/payroll-core`)

Two pure functions: `computeSalaryComponent` (attendance-driven pay — per-day rate, overtime, holiday wage, zero-attendance fallback) and `computeWorkAmount` (salary/hybrid/contract composition). No platform imports (enforced by the package's own `tsconfig.json`, which has no `"dom"` lib). This is the **sole** source for every number that's actually persisted or shown as authoritative — verified by `npm run test:payroll`, which runs 9 real scenarios against local Supabase and diffs payroll-core's TS result against `finalize_weekly_slip()`'s actual SQL result. All 9 currently pass.

Known minor issue: `apps/web/.../slips/AttendanceGrid.tsx` reimplements the salary-component formula by hand for a live preview label (not wired to any persisted value — cosmetic drift risk only, not a money bug).

## Offline queue (`packages/offline-queue-core`)

Platform-agnostic contract, zero DOM/platform imports (same purity pattern as payroll-core):

- `QueueItem { id, kind: 'entry'|'payment'|'attendance', payload, queuedAt, attempts }`
- `QueueStorageAdapter { getAll, add, remove, update }` — the only thing each platform implements
- `classifyFailure` — a `TypeError` means "network failure, safe to queue"; anything else is a real rejection
- `tryOrQueue` — try the real call, queue only on a genuine network failure, rethrow everything else unchanged
- `syncQueue` — drains the queue in order; success removes the item; a thrown network failure stops the whole drain (items stay queued); a returned `{ok:false, permanent:true}` (e.g. week finalized while offline) moves the item to a conflict list instead of retrying forever

**Three adapters**, each the only file allowed to import its platform's package:
- `adapters/tauriStore.ts` — `@tauri-apps/plugin-store`, dynamic import only
- `adapters/indexedDbStore.ts` — native `indexedDB`, the only statically-imported one (safe under SSR since it only touches the global when called)
- `adapters/capacitorStore.ts` — `@capacitor/preferences`, each method inlines its own dynamic import (a shared helper triggers a real "Preferences.then() is not implemented" thenable-proxy bug — confirmed and worked around)

**Platform selection** (`apps/web/src/lib/offlineQueue/index.ts`): `isTauri()` → `isCapacitor()` → `isBrowserWithIndexedDb()` → `null`, checked in that order since IndexedDB genuinely exists inside both native WebViews too.

**Wiring** (`apps/web/src/lib/offlineQueue/webAppWiring.ts`): the one file that knows about the real Server Actions. Wraps `createEntry`/`createPayment`/`saveAttendanceDay`; idempotency via a `clientId` (`crypto.randomUUID()`) attached at queue time, deduplicated server-side via a `23505` Postgres conflict check; reachability tracked via polling GoTrue's `/auth/v1/health` (not PostgREST's expensive schema-introspection root) with a loopback-rewrite fix so the probe resolves correctly from inside a native WebView pointed at a different host than the configured Supabase URL.

**Verified for real** (not just typechecked) across all three platforms: real `supabase stop`/`start` cycles, genuine offline queuing, reconnect + sync, idempotency (pre-inserted duplicate row + matching clientId → exactly one row), and conflict handling (finalized-week rejection → surfaced, not retried forever). Mobile was verified on a real physical Android device (native SharedPreferences file inspected directly via `adb shell run-as`), not just the browser fallback.

## Database (`supabase/migrations/`)

41 migrations, RLS enabled and policy-scoped on every tenant/platform table (verified — no missing-RLS or RLS-with-no-policies tables). Privileged writes (`finalize_weekly_slip`, `reopen_weekly_slip`, `create_organization`, `update_organization_billing`, etc.) are `SECURITY DEFINER` functions that each perform their own `has_org_role`/`is_platform_admin` check before mutating — RLS is otherwise the only enforcement layer for plain table writes, which is a deliberate single-layer design (documented in the code) rather than an oversight.

**Local vs. production parity — genuinely verified against the real linked project** (`ngliwkprsaytsegazwfk`, "Facto"), not assumed:
- Migrations 1–38: applied identically on both sides.
- Migration 39 (`grant_baseline_privileges`) and 41 (`local_service_role_grants`): intentionally **local-dev-only** parity fixes — production already has these grants via Supabase's own platform bootstrap. Not applying them to production is correct, not a gap.
- Migration 40 (`fix_advance_and_billing_grants`) was a **real, confirmed production security fix** — found not-applied during audit, safety-reviewed, applied to production via `supabase db query --linked` (exact 4 statements only), verified with 7 live zero-data-risk tests (`SET ROLE authenticated; UPDATE ... WHERE false`), and migration history reconciled via a scoped `migration repair --status applied 20260101000040`. Before the fix, `authenticated` had unrestricted `UPDATE` on `workers` (exposing `advance_balance`) and a narrower-than-assumed-but-still-incomplete grant on `organizations`. After: `workers` limited to 9 profile columns, `organizations` to 11 operational-settings columns — billing/advance columns excluded from both, confirmed via direct `information_schema` queries against production, not inferred from a diff.

## Environment separation

- `apps/web/.env.development.local` — loaded only by `next dev`, points at local Supabase (`127.0.0.1:54321`, the public demo anon key).
- `apps/web/.env.production.local` — loaded only by `next build`/`next start`, points at the real production Supabase project.
- `apps/web/src/lib/supabase/envGuard.ts` — a second, defensive layer: throws at process start if `NODE_ENV !== 'production'` and the configured URL isn't local, so a dev process can never accidentally talk to production.
- No production **web hosting** exists yet — no domain purchased, no deployment target chosen. This is the single biggest remaining blocker for real end-to-end production use.

## Mobile production-safety (`apps/mobile`)

`capacitor.config.ts` is environment-aware: production is the **default** shape (HTTPS, `PRODUCTION_APP_URL` — currently an empty placeholder with a `TODO`, guarded to throw if a non-dev build is attempted while it's empty); `FACTO_MOBILE_ENV=development` opts into the dev shape (`http://localhost:3001`, cleartext enabled, overridable via `FACTO_MOBILE_DEV_URL` for the emulator's `10.0.2.2`).

The Android manifest has **no hardcoded cleartext flag** — Capacitor's own `cap sync` writes `usesCleartextTraffic` into a generated module's manifest at sync time, driven directly by `capacitor.config.ts`'s `cleartext` value (confirmed by reading `@capacitor/cli`'s source and by testing both a dev sync and a production-shaped sync).

**Release-build guards** (`apps/mobile/android/app/build.gradle`), hooked onto the release variant's own `preBuild` task (not the `assembleRelease`/`bundleRelease` task names — a real bypass via `./gradlew :app:packageRelease` was found and fixed by moving the hook here, since `preBuild` is the one task every release-variant task transitively depends on):
- `checkProductionCapacitorConfig` — fails the build if the synced config still points at localhost/10.0.2.2/127.0.0.1, isn't HTTPS, has cleartext enabled, or the generated manifest still shows `usesCleartextTraffic`.
- `checkReleaseSigningConfigured` — fails the build if no signing keystore is configured.

**Signing**: no keystore exists yet. `apps/mobile/android/RELEASE_SIGNING.md` has the exact `keytool` command; credentials come from `FACTO_ANDROID_KEYSTORE_PATH`/`_PASSWORD`/`FACTO_ANDROID_KEY_ALIAS`/`_PASSWORD` env vars (CI) or a local gitignored `keystore.properties` (see `.example` template). Verified end-to-end with a real throwaway test keystore — produced a genuinely signed APK, confirmed via `apksigner verify`.

**Scripts**: `npm run sync:dev` / `npm run sync:prod` in `apps/mobile`.

## Desktop production-safety (`apps/desktop`)

`tauri.conf.json`'s window `url` is `https://production-domain-not-set.invalid` (RFC 2606 reserved TLD — guaranteed to never resolve, an intentional placeholder). `tauri.dev.conf.json` overrides just that field to `http://localhost:3001` via Tauri's `--config` merge, used by `npm run dev`.

`npm run build` (production path) runs `node scripts/check-production-config.mjs && tauri build`. The guard script has two checks: (1) refuses to build while the placeholder is still set, and (2) — added after a real bug was found — verifies `capabilities/default.json`'s `remote.urls` actually covers whatever origin `tauri.conf.json`'s window will load. Without check 2, a production build would load fine but the webview would get **zero Tauri permissions** (including `store:default`, silently breaking the offline queue's Tauri Store adapter) — found by realizing the capabilities file was never updated in sync with the URL config, verified by testing both a mismatched and a matching case.

`capabilities/default.json`'s `remote.urls` currently lists `http://localhost:3001/*` (dev) and `https://production-domain-not-set.invalid/*` (placeholder, mirroring the same convention) — update both this and `tauri.conf.json`'s URL together once a real domain exists.

No code-signing (Windows Authenticode / macOS notarization) is configured — a shipped installer will show an "unknown publisher" warning until that's added; not urgent, doesn't block building or running it.

## Building installables today

**Android debug APK** (works now, no domain/keystore needed):
```
cd apps/mobile && npm run sync:dev
cd android && ./gradlew assembleDebug
```
Output: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Points at `localhost:3001` — needs `adb reverse tcp:3001 tcp:3001` (+ `tcp:54321 tcp:54321` for Supabase) for a physical device, or `FACTO_MOBILE_DEV_URL=http://10.0.2.2:3001` resynced for the emulator.

**Desktop dev-pointed installer** (works now):
```
cd apps/desktop && npx tauri build --config src-tauri/tauri.dev.conf.json
```
Produces a real `.msi`/`.exe` (or platform equivalent) pointed at `localhost:3001` — only usable on the machine running the dev server.

**Real production installables** (blocked until domain + keystore exist):
```
# once PRODUCTION_APP_URL / tauri.conf.json url / capabilities remote.urls are all set,
# and an Android keystore exists (see RELEASE_SIGNING.md):
cd apps/mobile && npm run sync:prod && cd android && ./gradlew bundleRelease   # or assembleRelease
cd apps/desktop && npm run build
```

## Known remaining gaps (not yet fixed, not blocking current local work)

- No production web hosting/domain — the single biggest blocker for any real end-to-end production test.
- No Android release keystore, no Desktop code-signing certs.
- No CI/CD pipeline (`.github/workflows` is empty) — the release guards currently rely on whoever runs the build commands doing so correctly; a CI check that fails a release build containing `usesCleartextTraffic` would close the last gap.
- `npm audit` shows 6 high-severity advisories; `postcss`/`sharp` (transitive via `next`) are runtime-relevant and would need a deliberate, tested `next` upgrade to resolve — not done yet.
- No custom `error.tsx`/`not-found.tsx`/`loading.tsx` anywhere in `apps/web` — relies on Next's defaults.
- `AttendanceGrid.tsx`'s duplicated payroll-preview formula (see Payroll section above).
- iOS: only the unmodified `cap add ios` scaffold exists; nothing about it has been tested (no Mac/Xcode available in this environment).

## This session's persistent context

Everything above reflects verified, current state as of the last full audit + the production security fix (migration 040) being applied and confirmed live. See the auto-memory system (`MEMORY.md` and linked files) for narrower, evolving facts (branch policy, who's doing what) that don't belong in this architectural document.
