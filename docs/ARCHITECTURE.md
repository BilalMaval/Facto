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
- Domain purchased; no hosting/deployment target chosen yet, and the placeholder URLs in `tauri.conf.json`/`capabilities/default.json`/`PRODUCTION_APP_URL` (see below) haven't been updated to it. This is the remaining blocker for real end-to-end production use.

## File storage (Cloudflare R2)

- Worker photos and payment-proof uploads go through Cloudflare R2 (S3-compatible), not Supabase Storage — `apps/web/src/lib/storage/r2.ts` wraps `@aws-sdk/client-s3`/`@aws-sdk/s3-request-presigner` behind `uploadObject`/`getSignedReadUrl`, mirroring Supabase Storage's own upload/signed-URL shape so the 5 call sites (2 uploads, 3 reads) changed minimally.
- R2 has no equivalent to Supabase Storage's per-object RLS, so the authorization that RLS used to provide on the two upload paths now lives in application code: `apps/web/src/lib/session.ts`'s `requireOrgRole(organizationId, roles)` queries `memberships` directly and is called before every upload. The three read paths didn't need a new check — they're each already gated transitively (worker-photo reads sit behind a `workers` table query that's RLS-scoped to org members; the admin payment-proofs review page sits behind `admin/layout.tsx`'s `isPlatformAdmin()` gate).
- One R2 bucket, not two — `worker-photos` and `payment-proofs` are key prefixes within it (`worker-photos/{org_id}/...`, `payment-proofs/{org_id}/...`), not separate buckets. They used to be separate Supabase Storage buckets because each had its own bucket-level RLS policy; R2 has no per-bucket RLS at all, so that boundary wasn't doing any real work once authorization moved into application code — one bucket is simpler with no security tradeoff.
- Env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — see `apps/web/.env.example`. Dev and production use separate R2 buckets, same split as the Supabase vars above; only the dev one is wired up so far.
- The original Supabase Storage buckets/policies (`worker-photos`, `payment-proofs`) are left in the migrations, unused — no real data ever lived in them, and keeping them costs nothing while giving a trivial rollback path.

## Mobile production-safety (`apps/mobile`)

`capacitor.config.ts` is environment-aware: production is the **default** shape (HTTPS, `PRODUCTION_APP_URL` — currently an empty placeholder with a `TODO`, guarded to throw if a non-dev build is attempted while it's empty); `FACTO_MOBILE_ENV=development` opts into the dev shape (`http://localhost:3001`, cleartext enabled, overridable via `FACTO_MOBILE_DEV_URL` for the emulator's `10.0.2.2`).

The Android manifest has **no hardcoded cleartext flag** — Capacitor's own `cap sync` writes `usesCleartextTraffic` into a generated module's manifest at sync time, driven directly by `capacitor.config.ts`'s `cleartext` value (confirmed by reading `@capacitor/cli`'s source and by testing both a dev sync and a production-shaped sync).

**Release-build guards** (`apps/mobile/android/app/build.gradle`), hooked onto the release variant's own `preBuild` task (not the `assembleRelease`/`bundleRelease` task names — a real bypass via `./gradlew :app:packageRelease` was found and fixed by moving the hook here, since `preBuild` is the one task every release-variant task transitively depends on):
- `checkProductionCapacitorConfig` — fails the build if the synced config still points at localhost/10.0.2.2/127.0.0.1, isn't HTTPS, has cleartext enabled, or the generated manifest still shows `usesCleartextTraffic`.
- `checkReleaseSigningConfigured` — fails the build if no signing keystore is configured.

**Signing**: no keystore exists yet. `apps/mobile/android/RELEASE_SIGNING.md` has the exact `keytool` command; credentials come from `FACTO_ANDROID_KEYSTORE_PATH`/`_PASSWORD`/`FACTO_ANDROID_KEY_ALIAS`/`_PASSWORD` env vars (CI) or a local gitignored `keystore.properties` (see `.example` template). Verified end-to-end with a real throwaway test keystore — produced a genuinely signed APK, confirmed via `apksigner verify`.

**Scripts**: `npm run sync:dev` / `npm run sync:prod` in `apps/mobile`.

## Desktop production-safety (`apps/desktop`)

`tauri.conf.json`'s window `url` is `https://munshiman.com` (the real production domain — no longer a placeholder). `tauri.dev.conf.json` overrides just that field to `http://localhost:3001` via Tauri's `--config` merge, used by `npm run dev`.

`npm run build` (production path) runs `node scripts/check-production-config.mjs && tauri build`. The guard script has three checks: (1) refuses to build if the window URL is ever left as the `.invalid` placeholder again, (2) verifies `capabilities/default.json`'s `remote.urls` actually covers whatever origin `tauri.conf.json`'s window will load — without this, a production build would load fine but the webview would get **zero Tauri permissions** (including `store:default`, silently breaking the offline queue's Tauri Store adapter), and (3) refuses to build if `plugins.updater.pubkey` is still its placeholder (`PASTE-YOUR-...`) — see "Push notifications & auto-update" below.

`capabilities/default.json`'s `remote.urls` lists `http://localhost:3001/*` (dev) and `https://munshiman.com/*` (production) — update both this and `tauri.conf.json`'s URL together if the domain ever changes.

No code-signing (Windows Authenticode / macOS notarization) is configured — a shipped installer will show an "unknown publisher" warning until that's added; not urgent, doesn't block building, running, or auto-updating it.

## Push notifications & auto-update

Android gets **real push via Firebase Cloud Messaging (FCM)** — necessary because Android apps get suspended/killed and can't hold a live connection in the background. Desktop does **not** get a separate push service; it reuses the Realtime subscriptions the app already has (`RealtimeRefresh.tsx`, `realtimeSubscriptions.ts`) and fires a native OS notification via `tauri-plugin-notification` while the app is running (`DesktopNotificationListener.tsx`). Consequence: Desktop notifications only fire while the app is open, and **invite-created has no Desktop equivalent at all** — `invitations` RLS only grants the org's own owner/admin visibility, so the invitee's own session (the actual recipient) has no Realtime channel that event could ever arrive on. Android doesn't have this problem since FCM sending is a server-initiated HTTP call, independent of the recipient's session.

- New table `device_push_tokens` (Android-only — Desktop never writes to it) plus three `security definer` RPCs (`get_ticket_reply_recipient_tokens`, `get_payment_submission_recipient_tokens`, `get_invite_recipient_tokens`) that each re-derive their own authorization, the same way `has_org_role`/`is_platform_admin` do — there's no service-role client anywhere in this app.
- `apps/web/src/lib/push/fcm.ts` hand-rolls the FCM HTTP v1 client (Node's built-in `crypto`/`fetch`, no `firebase-admin`) — matches this codebase's existing "use the raw SDK directly" style (see `lib/storage/r2.ts`). Needs `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` set wherever the web app runs.
- Desktop's auto-updater (`tauri-plugin-updater`) checks a `latest.json` manifest hosted via GitHub Releases on this repo (confirmed public, so no auth token needs to be embedded in the shipped binary) — `apps/web/src/lib/push/desktopUpdater.ts` runs the check/download/relaunch cycle on app start. The updater's own tamper-verification keypair (`tauri signer generate`, free and self-managed) is separate from OS-level code signing — generate it once, put the public key in `tauri.conf.json`'s `plugins.updater.pubkey`, keep the private key + password durably (same care as the Android keystore below).
- `versionCode` in `apps/mobile/android/app/build.gradle` is derived from `git rev-list --count HEAD` at build time — strictly increasing automatically, so it can't be forgotten per Play Store release (Play Store rejects an upload whose versionCode doesn't exceed the last one).
- No CI exists yet, so the release flow for both platforms is manual: run the build locally with the relevant signing env vars set, then create a GitHub Release (Desktop: upload the installer + `.sig` + `latest.json`) or upload to Play Console (Android).

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

**Real production installables** (domain is set; blocked until the Android keystore and Tauri updater keypair exist):
```
# Android — once a keystore exists (see RELEASE_SIGNING.md):
cd apps/mobile && npm run sync:prod && cd android && ./gradlew bundleRelease   # or assembleRelease
# Desktop — once `tauri signer generate`'s pubkey is set in tauri.conf.json:
cd apps/desktop && npm run build
```

## Known remaining gaps (not yet fixed, not blocking current local work)

- Live in production on Vercel at munshiman.com — no longer a gap.
- No Android release keystore, no Desktop code-signing certs. No Google Play Developer account or Firebase project created yet either — both needed before push notifications/Play Store distribution can go live (see "Push notifications & auto-update" above for what's already wired in code vs. these remaining manual account-setup steps).
- No Tauri updater signing keypair generated yet — `tauri.conf.json`'s `plugins.updater.pubkey` is a placeholder, and `check-production-config.mjs` refuses to build Desktop for production until it's set.
- No CI/CD pipeline (`.github/workflows` is empty) — the release guards currently rely on whoever runs the build commands doing so correctly; a CI check that fails a release build containing `usesCleartextTraffic` would close the last gap.
- `npm audit`: 0 vulnerabilities (was 1 critical + 5 high — fixed by upgrading to `next@16.3.4`, which patched two critical unauthenticated-RCE advisories, one of them live and reachable on production before the fix).
- No custom `error.tsx`/`not-found.tsx`/`loading.tsx` anywhere in `apps/web` — relies on Next's defaults.
- `AttendanceGrid.tsx`'s duplicated payroll-preview formula (see Payroll section above).
- iOS: only the unmodified `cap add ios` scaffold exists; nothing about it has been tested (no Mac/Xcode available in this environment).

## This session's persistent context

Everything above reflects verified, current state as of the last full audit + the production security fix (migration 040) being applied and confirmed live. See the auto-memory system (`MEMORY.md` and linked files) for narrower, evolving facts (branch policy, who's doing what) that don't belong in this architectural document.
