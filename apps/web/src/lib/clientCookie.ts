'use client'

// Lightweight client-side preference cookies (last-viewed worker/week) — not
// sensitive, so a plain document.cookie write is fine; no server round-trip
// needed the way the active-org switch cookie requires (that one gates data
// access, this one only pre-fills a URL param that's re-validated server-side
// anyway). Deliberately no max-age: this makes it a session cookie, so it
// only lasts while the browser stays open, matching "remember what I was
// just looking at" rather than sticking around across days/logins.
export function setPreferenceCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; samesite=lax`
}
