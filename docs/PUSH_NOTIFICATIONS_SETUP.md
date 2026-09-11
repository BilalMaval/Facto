# Push notifications, Play Store, and Desktop auto-update — remaining setup

All the code for this is done, tested, and committed (see `docs/ARCHITECTURE.md`'s
"Push notifications & auto-update" section for how it works). What's left is a
handful of manual, account-based steps — none of it is code, and none of it can be
done by an agent since each one needs a human on an external account/dashboard.

Do these roughly in this order; each one unblocks the next.

## 1. Google Play Developer account

- [play.google.com/console](https://play.google.com/console) → sign up → $25 one-time fee.
- Create a new app: name "Facto", package `com.facto.mobile` (must match
  `apps/mobile/capacitor.config.ts`'s `appId`).
- You don't need to finish the listing yet — just get the app shell created so
  the package name is reserved.

## 2. Firebase project (for Android push)

- [console.firebase.google.com](https://console.firebase.google.com) → create a project (can reuse
  the same Google account as step 1, doesn't have to be the same one).
- Add an Android app to it: package name `com.facto.mobile`.
- Download the generated `google-services.json` and place it at
  `apps/mobile/android/app/google-services.json`. This file is **not** a
  secret (no private keys in it — just identifiers), so it's fine to commit;
  the repo's `.gitignore` already leaves it untracked-by-default so nothing
  auto-picks it up until you explicitly `git add` it.
- Project Settings → Service Accounts → **Generate new private key** →
  downloads a JSON file. From it, you need three values for env vars (see
  step 6): `project_id` → `FCM_PROJECT_ID`, `client_email` → `FCM_CLIENT_EMAIL`,
  `private_key` → `FCM_PRIVATE_KEY` (keep its `\n` characters literal when
  pasting into Vercel — don't convert them to real newlines).

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
