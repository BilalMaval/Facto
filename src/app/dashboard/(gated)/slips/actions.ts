'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function finalizeSlip(formData: FormData) {
  const organizationId = String(formData.get('organizationId') ?? '')
  const workerId = String(formData.get('workerId') ?? '')
  const weekStart = String(formData.get('weekStart') ?? '')
  const weekEnd = String(formData.get('weekEnd') ?? '')
  const finalAmount = Number(formData.get('finalAmount') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.rpc('finalize_weekly_slip', {
    p_org_id: organizationId,
    p_worker_id: workerId,
    p_week_start: weekStart,
    p_week_end: weekEnd,
    p_final_amount: finalAmount,
  })

  const qs = new URLSearchParams({ workerId, weekStart })
  if (error) qs.set('error', error.message)
  redirect(`/dashboard/slips?${qs.toString()}`)
}

export async function reopenSlip(formData: FormData) {
  const slipId = String(formData.get('slipId') ?? '')
  const workerId = String(formData.get('workerId') ?? '')
  const weekStart = String(formData.get('weekStart') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.rpc('reopen_weekly_slip', { p_slip_id: slipId })

  const qs = new URLSearchParams({ workerId, weekStart })
  if (error) qs.set('error', error.message)
  redirect(`/dashboard/slips?${qs.toString()}`)
}
