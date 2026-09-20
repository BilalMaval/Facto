import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { AdminFilterBar } from '@/app/admin/AdminFilterBar'
import { WorkCodeForm } from './WorkCodeForm'
import { WorkCodeRow } from './WorkCodeRow'

export default async function WorkCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; status?: string }>
}) {
  const { error, q = '', status = '' } = await searchParams
  const t = await getTranslations('workCodes')
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner' && membership.role !== 'admin') redirect('/dashboard')

  const org = membership.organization

  const STATUS_OPTIONS = [
    { value: '', label: t('allStatuses') },
    { value: 'active', label: t('active') },
    { value: 'inactive', label: t('inactive') },
  ]

  const supabase = await createClient()
  const { data: allWorkCodes } = await supabase
    .from('work_codes')
    .select('id, code, description, rate, is_active')
    .eq('organization_id', org.id)
    .order('code', { ascending: true })

  let workCodes = allWorkCodes ?? []
  if (status) workCodes = workCodes.filter((wc) => (status === 'active' ? wc.is_active : !wc.is_active))
  if (q) {
    const needle = q.toLowerCase()
    workCodes = workCodes.filter((wc) => [wc.code, wc.description].join(' ').toLowerCase().includes(needle))
  }

  const activeCount = workCodes.filter((wc) => wc.is_active).length
  const isFiltered = Boolean(q || status)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {t('subtitle', { orgName: org.name })}
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <AdminFilterBar
        basePath="/dashboard/work-codes"
        q={q}
        searchPlaceholder={t('searchPlaceholder')}
        selects={[{ name: 'status', label: t('filterStatus'), value: status, options: STATUS_OPTIONS }]}
        suggestions={(allWorkCodes ?? []).map((wc) => ({
          value: wc.code,
          label: `${wc.code} — ${wc.description}` + (wc.is_active ? '' : t('inactiveSuffix')),
        }))}
      />

      <div className="mt-6">
        <WorkCodeForm organizationId={org.id} />
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        {t('total')}: <span className="font-medium text-zinc-700">{workCodes.length}</span>
        {' · '}
        {t('active')}: <span className="font-medium text-emerald-700">{activeCount}</span>
        {' · '}
        {t('inactive')}: <span className="font-medium text-zinc-700">{workCodes.length - activeCount}</span>
        {isFiltered && (
          <span className="text-zinc-400"> ({t('ofTotal', { count: allWorkCodes?.length ?? 0 })})</span>
        )}
      </p>

      <div className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white px-4 shadow-sm">
        {!workCodes.length && (
          <p className="py-4 text-sm text-zinc-400">
            {allWorkCodes?.length ? t('noneMatchFilters') : t('noneYet')}
          </p>
        )}
        {workCodes.map((wc) => (
          <WorkCodeRow key={wc.id} workCode={wc} organizationId={org.id} />
        ))}
      </div>
    </div>
  )
}
