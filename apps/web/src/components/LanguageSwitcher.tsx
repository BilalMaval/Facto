'use client'

import { useTransition, type ChangeEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { setPreferredLanguage } from '@/lib/localeActions'
import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale'

export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations('common')
  const [isPending, startTransition] = useTransition()

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Locale
    startTransition(() => {
      setPreferredLanguage(next)
    })
  }

  return (
    <select
      aria-label={t('language')}
      value={locale}
      disabled={isPending}
      onChange={handleChange}
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 disabled:opacity-50"
    >
      {SUPPORTED_LOCALES.map((code) => (
        <option key={code} value={code}>
          {t(code === 'en' ? 'english' : 'urdu')}
        </option>
      ))}
    </select>
  )
}
