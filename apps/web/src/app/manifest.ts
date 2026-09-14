import type { MetadataRoute } from 'next'

// Chrome/ChromeOS "Install Facto" support. This is deliberately the ONLY
// place the installed-app name is "FS" — the Android (Capacitor) and
// Desktop (Tauri) apps keep showing "Facto" everywhere (their own
// AndroidManifest.xml / tauri.conf.json productName are untouched), since
// this manifest only affects Chrome's own install prompt and the resulting
// standalone PWA window/launcher entry, never those native shells.
//
// start_url matches what Capacitor's capacitor.config.ts and Tauri's
// tauri.conf.json already load in production ("/", which src/app/page.tsx
// redirects to /dashboard, then src/proxy.ts's updateSession() sends to
// /login if unauthenticated) — same entry point those shells already prove
// works, not a new route.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FS',
    short_name: 'FS',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
