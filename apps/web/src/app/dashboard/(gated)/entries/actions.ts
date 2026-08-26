'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'
import { isRetryableStatus } from '@/lib/supabase/retryableStatus'
import { currentWeekBounds, resolveWeekBounds, type WeekScheme } from '@/lib/dates'

// queued is set only by the offline-queue wrapper (lib/offlineQueue) when
// this call couldn't reach the server and was saved locally instead — never
// set by createEntry/createPayment themselves.
//
// networkError is the opposite direction: set BY createEntry/createPayment
// TO the offline-queue wrapper, marking an `error` that means "not safe to
// treat as a genuine, permanent rejection" — either the request never
// reached the server at all (status 0), or it reached PostgREST/Supabase but
// got a 5xx back, which is that layer's own way of saying it couldn't
// process the request right now (confirmed in practice: PostgREST returns
// one right after Postgres restarts, while its schema cache is still
// reloading) — not a verdict on the write itself the way a 4xx is (e.g. a
// finalized week or a bad value). Treating a 5xx as networkError: false was
// a real bug: syncQueue moved a queued write into "permanent conflict" and
// discarded it over what was really just PostgREST not being ready yet, a
// few seconds after Supabase came back up — see isRetryableStatus below.
// Supabase's client never lets a fetch failure reject the promise; it's
// swallowed into a normal { error } return value, which is why the wrapper
// can't tell these apart from a thrown exception the way tryOrQueue's
// classifyFailure otherwise expects. Every other caller of these actions
// ignores this field — it's only read by webAppWiring.ts. See
// isRetryableStatus (lib/supabase/retryableStatus.ts) for the status check.
export type FormState = { error?: string; success?: boolean; queued?: boolean; networkError?: boolean } | null

// Which week's slip a backdated entry/payment counts toward.
//
// If a week already exists (any status) that owns this date — including a
// week under a scheme the org has since moved away from — the entry counts
// there, exactly as if nothing about the org's settings had ever changed:
// finalized means it's a locked snapshot, so the entry shifts forward to
// the current week instead (it keeps its real date; only what it's tallied
// against moves); still-open (including reopened) means it counts directly
// into that same week, under its own original scheme, forever.
//
// Only when no existing week claims this date does today's scheme (and any
// pending transition — see lib/dates.ts) get to decide where it lands.
async function resolveCountedWeekStart(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  workerId: string,
  dateStr: string
) {
  const { data: org } = await supabase
    .from('organizations')
    .select('week_start_day, week_scheme_previous_start_day, week_scheme_transition_date')
    .eq('id', organizationId)
    .single()
  const scheme: WeekScheme = {
    weekStartDay: (org?.week_start_day ?? 'monday') as WeekScheme['weekStartDay'],
    previousWeekStartDay: (org?.week_scheme_previous_start_day ?? null) as WeekScheme['previousWeekStartDay'],
    transitionDate: org?.week_scheme_transition_date ?? null,
  }

  const { data: owningSlip } = await supabase
    .from('weekly_slips')
    .select('week_start, status')
    .eq('organization_id', organizationId)
    .eq('worker_id', workerId)
    .lte('week_start', dateStr)
    .gte('week_end', dateStr)
    .maybeSingle()

  if (owningSlip) {
    return owningSlip.status === 'finalized' ? currentWeekBounds(scheme).weekStart : owningSlip.week_start
  }

  const { weekStart: targetWeekStart } = resolveWeekBounds(dateStr, scheme)
  const { data: targetSlip } = await supabase
    .from('weekly_slips')
    .select('status')
    .eq('organization_id', organizationId)
    .eq('worker_id', workerId)
    .eq('week_start', targetWeekStart)
    .maybeSingle()

  return targetSlip?.status === 'finalized' ? currentWeekBounds(scheme).weekStart : targetWeekStart
}

export async function createEntry(_prevState: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  const workerId = String(formData.get('workerId') ?? '')
  const entryDate = String(formData.get('entryDate') ?? '')
  const workCodeId = String(formData.get('workCodeId') ?? '')
  const quantity = Number(formData.get('quantity') ?? '')
  // Only ever set by the offline-queue sync replay (see lib/offlineQueue) —
  // lets a retried entry land on the same row instead of duplicating one
  // that actually reached the server the first time (see the 23505 check
  // below). Absent on every normal, non-queued submission.
  const clientId = formData.get('clientId')?.toString() || undefined

  if (!workerId || !entryDate || !workCodeId || !quantity) {
    return { error: 'Worker, date, work code, and quantity are required' }
  }

  const supabase = await createClient()
  const user = await getResilientUser(supabase)
  if (!user) redirect('/login')

  const countedWeekStart = await resolveCountedWeekStart(supabase, organizationId, workerId, entryDate)

  const { error, status } = await supabase.from('work_entries').insert({
    ...(clientId ? { id: clientId } : {}),
    organization_id: organizationId,
    worker_id: workerId,
    entry_date: entryDate,
    work_code_id: workCodeId,
    quantity,
    created_by: user.id,
    counted_week_start: countedWeekStart,
  })

  if (error) {
    if (error.code === '23505' && clientId) {
      revalidatePath('/dashboard/entries')
      revalidatePath('/dashboard')
      return { success: true }
    }
    // See isRetryableStatus above and the FormState comment for why this
    // isn't just `status === 0`.
    return { error: error.message, networkError: isRetryableStatus(status) }
  }

  revalidatePath('/dashboard/entries')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteEntry(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('returnTo') ?? '/dashboard/entries')

  const supabase = await createClient()
  const { error } = await supabase.from('work_entries').delete().eq('id', id)

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/entries')
  revalidatePath('/dashboard')
}

export async function createPayment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  const workerId = String(formData.get('workerId') ?? '')
  const paymentDate = String(formData.get('paymentDate') ?? '')
  const amount = Number(formData.get('amount') ?? '')
  const note = String(formData.get('note') ?? '').trim()
  // See the matching comment in createEntry — offline-queue replay only.
  const clientId = formData.get('clientId')?.toString() || undefined

  if (!workerId || !paymentDate || !amount) {
    return { error: 'Worker, date, and amount are required' }
  }

  const supabase = await createClient()
  const user = await getResilientUser(supabase)
  if (!user) redirect('/login')

  const countedWeekStart = await resolveCountedWeekStart(supabase, organizationId, workerId, paymentDate)

  const { error, status } = await supabase.from('payments').insert({
    ...(clientId ? { id: clientId } : {}),
    organization_id: organizationId,
    worker_id: workerId,
    payment_date: paymentDate,
    amount,
    note: note || null,
    created_by: user.id,
    counted_week_start: countedWeekStart,
  })

  if (error) {
    if (error.code === '23505' && clientId) {
      revalidatePath('/dashboard/entries')
      revalidatePath('/dashboard')
      return { success: true }
    }
    // See isRetryableStatus above and the FormState comment for why this
    // isn't just `status === 0`.
    return { error: error.message, networkError: isRetryableStatus(status) }
  }

  revalidatePath('/dashboard/entries')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deletePayment(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const returnTo = String(formData.get('returnTo') ?? '/dashboard/entries')

  const supabase = await createClient()
  const { error } = await supabase.from('payments').delete().eq('id', id)

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/dashboard/entries')
  revalidatePath('/dashboard')
}
