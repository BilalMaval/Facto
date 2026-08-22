import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { AdminFilterBar } from '@/app/admin/AdminFilterBar'
import type { DateFormat } from '@/lib/dates'
import { workerLabel } from '@/lib/format'
import { WorkerForm } from './WorkerForm'
import { WorkerRow, type EmploymentType } from './WorkerRow'

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All payment types' },
  { value: 'contract', label: 'Contract' },
  { value: 'salary', label: 'Salary' },
  { value: 'hybrid', label: 'Hybrid' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; employmentType?: string; status?: string }>
}) {
  const { error, q = '', employmentType = '', status = '' } = await searchParams
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner' && membership.role !== 'admin') redirect('/dashboard')

  const org = membership.organization

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
      const { data } = await supabase.storage
        .from('worker-photos')
        .createSignedUrl(w.photo_url, 3600)
      if (data?.signedUrl) photoUrls.set(w.id, data.signedUrl)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Workers</h1>
      <p className="mt-1 text-sm text-zinc-500">Worker profiles for {org.name}.</p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <AdminFilterBar
        basePath="/dashboard/workers"
        q={q}
        searchPlaceholder="Search by name, Worker ID, or CNIC…"
        selects={[
          { name: 'employmentType', label: 'Payment type', value: employmentType, options: EMPLOYMENT_TYPE_OPTIONS },
          { name: 'status', label: 'Status', value: status, options: STATUS_OPTIONS },
        ]}
        suggestions={(allWorkers ?? []).map((w) => ({
          value: w.name,
          label: workerLabel(w) + (w.is_active ? '' : ' (inactive)'),
        }))}
      />

      <div className="mt-6">
        <WorkerForm organizationId={org.id} dateFormat={org.date_format as DateFormat} />
      </div>

      <div className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white px-4 shadow-sm">
        {!workers.length && (
          <p className="py-4 text-sm text-zinc-400">
            {allWorkers?.length ? 'No workers match these filters.' : 'No workers yet.'}
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
