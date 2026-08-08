import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { WorkCodeForm } from './WorkCodeForm'
import { WorkCodeRow } from './WorkCodeRow'

export default async function WorkCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner' && membership.role !== 'admin') redirect('/dashboard')

  const org = membership.organization

  const supabase = await createClient()
  const { data: workCodes } = await supabase
    .from('work_codes')
    .select('id, code, description, rate, is_active')
    .eq('organization_id', org.id)
    .order('code', { ascending: true })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Work codes</h1>
      <p className="mt-1 text-sm text-zinc-500">
        The price list staff use to log daily output for {org.name}.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <WorkCodeForm organizationId={org.id} />

      <div className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white px-4 shadow-sm">
        {!workCodes?.length && (
          <p className="py-4 text-sm text-zinc-400">No work codes yet.</p>
        )}
        {workCodes?.map((wc) => (
          <WorkCodeRow key={wc.id} workCode={wc} />
        ))}
      </div>
    </div>
  )
}
