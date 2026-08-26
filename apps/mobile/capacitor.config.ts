import type { CapacitorConfig } from '@capacitor/cli'

// Same "Model A" shape as the Tauri desktop shell (apps/desktop/src-tauri/tauri.conf.json):
// the native shell's WebView points directly at the running Next.js dev server
// instead of bundling a static export. This app relies on Server Actions and
// cookie-based sessions, which a static export can't serve — the web app has
// to keep running as a real server, on Desktop and Mobile alike.
//
// webDir is required by the Capacitor CLI (used by `cap sync` to copy bundled
// web assets into the native project) but is never actually loaded at runtime
// once `server.url` is set — see www/index.html for why it's just a stub,
// exactly like desktop/src's unused create-tauri-app template.
const config: CapacitorConfig = {
  appId: 'com.facto.mobile',
  appName: 'Facto',
  webDir: 'www',
  server: {
    // 10.0.2.2 is the Android emulator's alias for the host machine's
    // localhost — a real device on the same network would need the host's
    // LAN IP instead, since "localhost" from inside the device/emulator
    // means the device itself, not the dev machine running Next.js.
    url: 'http://10.0.2.2:3001',
    cleartext: true,
  },
}

export default config
