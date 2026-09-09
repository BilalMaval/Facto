'use client'

import { useTranslations } from 'next-intl'

export function PrintButton() {
  const t = useTranslations('common')
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
    >
      {t('printSlip')}
    </button>
  )
}
