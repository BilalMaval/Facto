import { useTranslations } from 'next-intl'

export type CodeStatus = 'idle' | 'checking' | 'available' | 'taken'

export function CodeAvailabilityHint({ status, label }: { status: CodeStatus; label: string }) {
  const t = useTranslations('workers.availability')
  if (status === 'checking') return <p className="mt-1 text-xs text-zinc-400">{t('checking')}</p>
  if (status === 'available') return <p className="mt-1 text-xs text-emerald-600">{t('available')}</p>
  if (status === 'taken') return <p className="mt-1 text-xs text-red-600">{t('taken', { label })}</p>
  return null
}
