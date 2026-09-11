# Push notifications, Play Store, and Desktop auto-update — remaining setup

All the code for this is done, tested, and committed (see `docs/ARCHITECTURE.md`'s
"Push notifications & auto-update" section for how it works). What's left is a
handful of manual, account-based steps — none of it is code, and none of it can be
done by an agent since each one needs a human on an external account/dashboard.

Do these roughly in this order; each one unblocks the next.

## Implementation verification (plan vs. actual)

Every part of the approved plan was implemented as specified — no scope
creep, no silently-skipped steps. Checked directly against the actual files,
not from memory, before writing this:

- **Domain placeholders** (`capacitor.config.ts`, `tauri.conf.json`,
  `capabilities/default.json`) — fixed, guard script confirmed passing.
- **Migration** (`20260101000043_push_notifications.sql`) — the
  `device_push_tokens` table and all three `security definer` recipient
  functions exist exactly as planned and named.
- **All 6 `lib/push/*` files** plus `pushTokens.ts` and the two client
  components — all present. One naming note, not a real deviation:
  `desktopUpdater.ts` uses `update.downloadAndInstall()` (the real
  `@tauri-apps/plugin-updater` API's actual combined method) rather than the
  plan's simplified "`download() → install()`" shorthand — same behavior.
- **All 4 trigger call sites** use `after()` exactly as planned (verified
  stable against this Next.js version's own docs first, per standing
  instruction, before using it) — the fallback was never needed.
- **Android**: plugin added to both `apps/web` and `apps/mobile`, `cap sync`
  wired it automatically with zero manual Gradle edits, `versionCode` now
  derives from `git rev-list --count HEAD` — confirmed in a real built APK's
  manifest.
- **Desktop**: `Cargo.toml`/`lib.rs`/`tauri.conf.json`/`capabilities` all
  match the plan; JS packages correctly placed in `apps/web/package.json`,
  not `apps/desktop`.

**Live-verified, not just code-reviewed:**
- All 3 notification triggers exercised for real against local Supabase,
  confirmed to fail gracefully with zero FCM credentials configured.
- Real Android push, end-to-end, on a physical device (the emulator proved
  too resource-constrained on this machine) — a real reply through the
  actual dashboard UI produced a real notification on the phone, text
  matching `notify.ts` exactly.
- Real Desktop notification call (`sendDesktopNotification`) confirmed
  resolving with no error inside the actual running Tauri app.
- The real `tauri-plugin-updater` (identified by its own user-agent in
  server logs, not a test script) automatically checked a manifest,
  detected a newer version, and downloaded the installer, using a
  throwaway test signing key. The final silent-install step hit a Windows
  UAC prompt this headless environment can't approve — expected for a
  per-machine install with no one at the keyboard, not a bug; verified
  through download, same as the plan's own verification section anticipated
  needing "once Desktop plugins are wired."
- Confirmed structurally (not just by absence of a failure) that
  invite-created cannot fire on Desktop: `DesktopNotificationListener.tsx`
  has no subscription to the `invitations` table at all, so there's no code
  path that could ever attempt it.

All temporary test artifacts (throwaway signing keys, local test server,
temporary code injected for testing, test-installed builds) were fully
removed and reverted after each verification pass — only the real,
permanent implementation is in the repo.

## 1. Google Play Developer account

- [play.google.com/console](https://play.google.com/console) → sign up → $25 one-time fee.
- Create a new app: name "Facto", package `com.facto.mobile` (must match
  `apps/mobile/capacitor.config.ts`'s `appId`).
- You don't need to finish the listing yet — just get the app shell created so
  the package name is reserved.

## 2. Firebase project (for Android push) — ✅ done

Project `facto-frb` created, Android app registered, `google-services.json`
committed at `apps/mobile/android/app/google-services.json`, and the
service-account credentials verified working end-to-end (real OAuth token
exchange, real push delivered to a real device — see the verification
section above). Nothing left to do here.

The service-account values (`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`,
`FCM_PRIVATE_KEY`) are sitting in local `.env.development.local` for dev —
they still need to be added to Vercel's environment variables (step 6
below) before production sending will work.

## 3. Android release keystore

- Exact command already documented in
  `apps/mobile/android/RELEASE_SIGNING.md`:
  ```
  keytool -genkeypair -v -keystore facto-release.jks -alias facto -keyalg RSA -keysize 2048 -validity 10000
  ```
- **Store the resulting `.jks` file and its passwords somewhere durable and
  backed up.** If you lose this keystore, you can never update the app on
  Play Store again under the same listing — Google can't reissue it.
- Either set `FACTO_ANDROID_KEYSTORE_PATH` / `FACTO_ANDROID_KEYSTORE_PASSWORD`
  / `FACTO_ANDROID_KEY_ALIAS` / `FACTO_ANDROID_KEY_PASSWORD` as environment
  variables wherever you build, or copy
  `apps/mobile/android/keystore.properties.example` to
  `keystore.properties` (gitignored) and fill it in there.

## 4. Tauri updater signing keypair (Desktop)

- From `apps/desktop`, run:
  ```
  npx tauri signer generate -w facto-updater.key
  ```
- It'll print a public key — paste that into
  `apps/desktop/src-tauri/tauri.conf.json`'s `plugins.updater.pubkey`
  (currently a placeholder; the build will keep refusing to proceed until
  this is a real key — that's intentional, confirmed working).
- **Store `facto-updater.key` and the password you set durably**, same care
  as the Android keystore — this is what lets your Desktop app verify future
  updates are genuinely from you, not tampered with. It's already gitignored
  (`*.key` in `apps/desktop/src-tauri/.gitignore`).
- Set `TAURI_SIGNING_PRIVATE_KEY` (the file's contents) and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as env vars wherever you run
  `npm run build` for Desktop — `tauri build` reads these automatically to
  sign the installer.

## 5. Privacy policy

- Play Store requires one for any app requesting notification permission.
- Doesn't need to be fancy — a single hosted page describing what data the
  app collects (worker/payroll records, notification device tokens) and how
  it's used is enough. Host it anywhere public and link it in the Play
  Console listing.

## 6. Env vars — set these wherever the web app runs (Vercel, for production)

| Variable | From |
|---|---|
| `FCM_PROJECT_ID` | Firebase service-account JSON, step 2 |
| `FCM_CLIENT_EMAIL` | Firebase service-account JSON, step 2 |
| `FCM_PRIVATE_KEY` | Firebase service-account JSON, step 2 |

(The Android keystore and Tauri signing vars from steps 3–4 are only needed
wherever you actually *build* the native apps, not in Vercel.)

## 7. First releases (manual — no CI exists yet)

- **Android**: `cd apps/mobile && npm run sync:prod && cd android && ./gradlew bundleRelease`,
  then upload the resulting `.aab` to Play Console's internal testing track first.
- **Desktop**: `cd apps/desktop && npm run build`, then create a GitHub
  Release on this repo (it's public, confirmed the updater endpoint can read
  it without any auth token) and upload the installer + `.sig` + `latest.json`
  files it produces.

## What you get once this is all done

- Installing the Android app from Play Store means it auto-updates itself
  from then on, the normal way — no more manual APK reinstalls.
- Installing the Desktop app once means it checks for and installs updates
  on every launch (via `lib/push/desktopUpdater.ts`), no more manual
  installer reinstalls.
- A new support ticket reply, a payment submission being reviewed, or a team
  invite (when the invitee already has an account) will push a real
  notification to any registered Android device, and — while the app is
  open — a native notification on Desktop too (except invite-created, which
  is Android-only; see `ARCHITECTURE.md` for why).
