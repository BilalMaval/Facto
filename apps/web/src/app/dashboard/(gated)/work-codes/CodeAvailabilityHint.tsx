import { useTranslations } from 'next-intl'

export type CodeStatus = 'idle' | 'checking' | 'available' | 'taken'

export function CodeAvailabilityHint({ status }: { status: CodeStatus }) {
  const t = useTranslations('workCodes.availability')
  if (status === 'checking') return <p className="mt-1 text-xs text-zinc-400">{t('checking')}</p>
  if (status === 'available') return <p className="mt-1 text-xs text-emerald-600">{t('available')}</p>
  if (status === 'taken') return <p className="mt-1 text-xs text-red-600">{t('taken')}</p>
  return null
}
