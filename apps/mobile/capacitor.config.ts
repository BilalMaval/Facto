import type { CapacitorConfig } from '@capacitor/cli'

// Same "Model A" shape as the Tauri desktop shell (apps/desktop/src-tauri/tauri.conf.json):
// the native shell's WebView points directly at a running Next.js server
// instead of bundling a static export. This app relies on Server Actions and
// cookie-based sessions, which a static export can't serve — the web app has
// to keep running as a real server, on Desktop and Mobile alike.
//
// webDir is required by the Capacitor CLI (used by `cap sync` to copy bundled
// web assets into the native project) but is never actually loaded at runtime
// once `server.url` is set — see www/index.html for why it's just a stub,
// exactly like desktop/src's unused create-tauri-app template.

// Fill this in once the production domain is live. Left blank deliberately —
// see the guard below, which refuses to produce a production-shaped config
// pointed at nothing rather than silently shipping a broken build. Matches
// apps/web/src/lib/supabase/envGuard.ts's philosophy in this codebase: the
// safe path is the default, the permissive (dev) path requires opting in.
const PRODUCTION_APP_URL = '' // TODO: e.g. 'https://app.yourcompany.com'

// Opt-in only — production shape is the default so a plain `npx cap sync
// android` / `npx cap build android` can never accidentally produce a
// dev-pointed build. Set before running any cap command:
//   bash:       FACTO_MOBILE_ENV=development npx cap sync android
//   PowerShell: $env:FACTO_MOBILE_ENV='development'; npx cap sync android
const isDev = process.env.FACTO_MOBILE_ENV === 'development'

// Dev-only override for whichever host actually reaches your running dev
// server — 10.0.2.2 for the Android emulator (its alias for the host
// machine), or plain localhost for a physical device over `adb reverse
// tcp:3001 tcp:3001` (and `tcp:54321 tcp:54321` for Supabase) — adb reverse
// makes "localhost" on the DEVICE resolve back to the host's own localhost,
// same semantics as Tauri/browser. Defaults to the physical-device value.
const devUrl = process.env.FACTO_MOBILE_DEV_URL ?? 'http://localhost:3001'

if (!isDev && !PRODUCTION_APP_URL) {
  throw new Error(
    'Refusing to build for production: PRODUCTION_APP_URL is not set in ' +
      'apps/mobile/capacitor.config.ts. Set it once the production domain ' +
      'is live, or pass FACTO_MOBILE_ENV=development to build against your ' +
      'local dev server instead.'
  )
}

const config: CapacitorConfig = {
  appId: 'com.facto.mobile',
  appName: 'Facto',
  webDir: 'www',
  server: isDev
    ? { url: devUrl, cleartext: true }
    : // No cleartext — HTTPS only, Capacitor's default. `cap sync` bakes
      // this straight into the generated
      // android/capacitor-cordova-android-plugins module's manifest at
      // sync time (confirmed by reading @capacitor/cli's own cordova.js) —
      // there's no separate manifest flag to keep in sync by hand. This
      // means whichever mode you last ran `cap sync` in is what the native
      // project reflects: always run `npm run sync:prod` (this file, no
      // FACTO_MOBILE_ENV) immediately before building a release APK, not a
      // stale sync left over from local dev testing.
      { url: PRODUCTION_APP_URL },
}

export default config
