import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { AdminFilterBar } from '@/app/admin/AdminFilterBar'
import { WorkCodeForm } from './WorkCodeForm'
import { WorkCodeRow } from './WorkCodeRow'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export default async function WorkCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; status?: string }>
}) {
  const { error, q = '', status = '' } = await searchParams
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner' && membership.role !== 'admin') redirect('/dashboard')

  const org = membership.organization

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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Work codes</h1>
      <p className="mt-1 text-sm text-zinc-500">
        The price list staff use to log daily output for {org.name}.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <AdminFilterBar
        basePath="/dashboard/work-codes"
        q={q}
        searchPlaceholder="Search by code or description…"
        selects={[{ name: 'status', label: 'Status', value: status, options: STATUS_OPTIONS }]}
      />

      <div className="mt-6">
        <WorkCodeForm organizationId={org.id} />
      </div>

      <div className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white px-4 shadow-sm">
        {!workCodes.length && (
          <p className="py-4 text-sm text-zinc-400">
            {allWorkCodes?.length ? 'No work codes match these filters.' : 'No work codes yet.'}
          </p>
        )}
        {workCodes.map((wc) => (
          <WorkCodeRow key={wc.id} workCode={wc} />
        ))}
      </div>
    </div>
  )
}
