import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { getSignedReadUrl } from '@/lib/storage/r2'
import { AdminFilterBar } from '@/app/admin/AdminFilterBar'
import type { DateFormat } from '@/lib/dates'
import { workerLabel } from '@/lib/format'
import { WorkerForm } from './WorkerForm'
import { WorkerRow, type EmploymentType } from './WorkerRow'

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; employmentType?: string; status?: string }>
}) {
  const { error, q = '', employmentType = '', status = '' } = await searchParams
  const t = await getTranslations('workers')
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner' && membership.role !== 'admin') redirect('/dashboard')

  const org = membership.organization

  const EMPLOYMENT_TYPE_OPTIONS = [
    { value: '', label: t('allPaymentTypes') },
    { value: 'contract', label: t('contract') },
    { value: 'salary', label: t('salary') },
    { value: 'hybrid', label: t('hybrid') },
  ]

  const STATUS_OPTIONS = [
    { value: '', label: t('allStatuses') },
    { value: 'active', label: t('active') },
    { value: 'inactive', label: t('inactive') },
  ]

  const supabase = await createClient()
  const { data: allWorkers } = await supabase
    .from('workers')
    .select(
      'id, worker_code, name, father_name, contact_no, designation, address, cnic, date_of_birth, photo_url, advance_balance, is_active, employment_type, weekly_salary'
    )
    .eq('organization_id', org.id)
    .order('worker_code', { ascending: true })

  let workers = allWorkers ?? []
  if (status) workers = workers.filter((w) => (status === 'active' ? w.is_active : !w.is_active))
  if (employmentType) workers = workers.filter((w) => w.employment_type === employmentType)
  if (q) {
    const needle = q.toLowerCase()
    workers = workers.filter((w) =>
      [w.name, w.worker_code, w.cnic].filter(Boolean).join(' ').toLowerCase().includes(needle)
    )
  }

  const photoUrls = new Map<string, string>()
  for (const w of workers) {
    if (w.photo_url) {
      try {
        photoUrls.set(w.id, await getSignedReadUrl('worker-photos', w.photo_url))
      } catch {
        // Same graceful-degradation as before: a signing failure just means
        // this one worker's photo doesn't render, not a page-wide error.
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t('subtitle', { orgName: org.name })}</p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <AdminFilterBar
        basePath="/dashboard/workers"
        q={q}
        searchPlaceholder={t('searchPlaceholder')}
        selects={[
          { name: 'employmentType', label: t('filterPaymentType'), value: employmentType, options: EMPLOYMENT_TYPE_OPTIONS },
          { name: 'status', label: t('filterStatus'), value: status, options: STATUS_OPTIONS },
        ]}
        suggestions={(allWorkers ?? []).map((w) => ({
          value: w.name,
          label: workerLabel(w) + (w.is_active ? '' : t('inactiveSuffix')),
        }))}
      />

      <div className="mt-6">
        <WorkerForm organizationId={org.id} dateFormat={org.date_format as DateFormat} />
      </div>

      <div className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white px-4 shadow-sm">
        {!workers.length && (
          <p className="py-4 text-sm text-zinc-400">
            {allWorkers?.length ? t('noneMatchFilters') : t('noneYet')}
          </p>
        )}
        {workers.map((w) => (
          <WorkerRow
            key={w.id}
            // employment_type is a CHECK-constrained column, which
            // supabase gen types doesn't reflect as a union — narrow it
            // here instead of loosening the component's own prop type.
            worker={{ ...w, employment_type: w.employment_type as EmploymentType }}
            organizationId={org.id}
            photoUrl={photoUrls.get(w.id)}
            currency={org.currency}
            showDecimals={org.show_decimals}
            dateFormat={org.date_format as DateFormat}
            viewerRole={membership.role}
          />
        ))}
      </div>
    </div>
  )
}
