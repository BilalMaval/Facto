import { getRequestConfig } from 'next-intl/server'
import { getPreferredLocale } from '@/lib/preferredLocale'

// No [locale] route segment exists, so the `requestLocale` param next-intl
// normally derives from the URL is never used here — the locale comes from
// getPreferredLocale() (cookie today; falls back to a DB lookup once the
// per-user language switcher lands).
export default getRequestConfig(async () => {
  const locale = await getPreferredLocale()
  const messages = (await import(`../../messages/${locale}.json`)).default

  return { locale, messages }
})
