// Same fail-fast guard as apps/mobile/capacitor.config.ts's PRODUCTION_APP_URL
// check, adapted for Tauri: tauri.conf.json is declarative JSON, not
// executable code, so it can't carry a throw-if-placeholder-unset check
// itself the way Capacitor's TS config can — this script is that check,
// run before `tauri build` (see package.json's "build" script) rather than
// inline in the config.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const configPath = join(root, '../src-tauri/tauri.conf.json')
const config = JSON.parse(readFileSync(configPath, 'utf-8'))
const url = config.app?.windows?.[0]?.url ?? ''

// .invalid is a reserved TLD (RFC 2606) guaranteed to never resolve —
// exactly what tauri.conf.json ships with until a real production domain
// is chosen. See that file's comment.
if (url.includes('.invalid')) {
  console.error(
    'Refusing to build for production: apps/desktop/src-tauri/tauri.conf.json\'s ' +
      `window url is still the placeholder ("${url}"). Set it to the real ` +
      'production domain once it exists, or run `npm run dev` (which builds ' +
      'against your local dev server via tauri.dev.conf.json) instead.'
  )
  process.exit(1)
}

// Second, independent check: the window's real URL must actually be covered
// by a capabilities/default.json remote.urls entry, or the production build
// would load fine but the webview would have zero Tauri permissions —
// including store:default, silently breaking the offline queue's Tauri
// Store adapter. This exact mismatch happened for real once already (fixed
// in the same change that added this check) — this exists so it can't
// silently happen again the next time the production URL changes.
const capabilitiesPath = join(root, '../src-tauri/capabilities/default.json')
const capabilities = JSON.parse(readFileSync(capabilitiesPath, 'utf-8'))
const remoteUrls = capabilities.remote?.urls ?? []
const windowOrigin = new URL(url).origin
const covered = remoteUrls.some((pattern) => {
  try {
    return new URL(pattern.replace(/\*/g, 'x')).origin === windowOrigin
  } catch {
    return false
  }
})
if (!covered) {
  console.error(
    `Refusing to build for production: the window will load "${url}", but ` +
      "src-tauri/capabilities/default.json's remote.urls has no entry " +
      'matching that origin, so the production build would have zero Tauri ' +
      'permissions (including store:default — the offline queue would ' +
      'silently stop working). Add a matching entry to capabilities/' +
      'default.json\'s remote.urls alongside setting PRODUCTION_APP_URL.'
  )
  process.exit(1)
}
