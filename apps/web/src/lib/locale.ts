// Client-safe: constants/types only, no server-only imports. Kept separate
// from getPreferredLocale (preferredLocale.ts) because that function pulls in
// next/headers + the Supabase server client — importing anything from a
// single shared module drags the whole module graph along, which broke
// LanguageSwitcher.tsx (a Client Component) when this file had both.
export const LOCALE_COOKIE = 'preferred_language'
export const SUPPORTED_LOCALES = ['en', 'ur'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
