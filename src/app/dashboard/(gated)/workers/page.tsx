import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { WorkerForm } from './WorkerForm'
import { WorkerRow } from './WorkerRow'

export default async function WorkersPage({
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
  const { data: workers } = await supabase
    .from('workers')
    .select(
      'id, worker_code, name, father_name, contact_no, designation, address, cnic, date_of_birth, photo_url, advance_balance, is_active'
    )
    .eq('organization_id', org.id)
    .order('worker_code', { ascending: true })

  const photoUrls = new Map<string, string>()
  for (const w of workers ?? []) {
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

      <WorkerForm organizationId={org.id} />

      <div className="mt-6 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white px-4 shadow-sm">
        {!workers?.length && <p className="py-4 text-sm text-zinc-400">No workers yet.</p>}
        {workers?.map((w) => (
          <WorkerRow key={w.id} worker={w} organizationId={org.id} photoUrl={photoUrls.get(w.id)} />
        ))}
      </div>
    </div>
  )
}
