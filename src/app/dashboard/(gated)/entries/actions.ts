'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { currentWeekBounds, resolveWeekBounds, type WeekScheme } from '@/lib/dates'

export type FormState = { error?: string; success?: boolean } | null

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

  if (!workerId || !entryDate || !workCodeId || !quantity) {
    return { error: 'Worker, date, work code, and quantity are required' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const countedWeekStart = await resolveCountedWeekStart(supabase, organizationId, workerId, entryDate)

  const { error } = await supabase.from('work_entries').insert({
    organization_id: organizationId,
    worker_id: workerId,
    entry_date: entryDate,
    work_code_id: workCodeId,
    quantity,
    created_by: user.id,
    counted_week_start: countedWeekStart,
  })

  if (error) {
    return { error: error.message }
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

  if (!workerId || !paymentDate || !amount) {
    return { error: 'Worker, date, and amount are required' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const countedWeekStart = await resolveCountedWeekStart(supabase, organizationId, workerId, paymentDate)

  const { error } = await supabase.from('payments').insert({
    organization_id: organizationId,
    worker_id: workerId,
    payment_date: paymentDate,
    amount,
    note: note || null,
    created_by: user.id,
    counted_week_start: countedWeekStart,
  })

  if (error) {
    return { error: error.message }
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
