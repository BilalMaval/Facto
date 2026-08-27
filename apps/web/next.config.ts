import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only (has no effect on next build/next start). Needed for the
  // Capacitor Android shell (apps/mobile) — its WebView loads this dev
  // server via 10.0.2.2 (the emulator's alias for the host), a distinct
  // origin from localhost, so Next's dev-resource CORS guard blocks the
  // webpack-hmr WebSocket from it by default. Without this, the failed HMR
  // reconnect loop causes repeated full-page reloads inside the native app —
  // confirmed via the dev server log ("Blocked cross-origin request to
  // Next.js dev resource /_next/webpack-hmr from 10.0.2.2") and by the
  // resulting rapid-fire GET /login requests, which was wiping in-progress
  // form input during native Android testing. Desktop/Tauri never hit this
  // because it loads the dev server via plain localhost, already allowed by
  // default.
  allowedDevOrigins: ['10.0.2.2'],
  experimental: {
    // Default 1MB is too small for photo/payment-proof uploads (server
    // actions receive the file as part of the request body) — compression
    // brings files down a lot, but a busy screenshot can still land in the
    // low single-digit MB range.
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
