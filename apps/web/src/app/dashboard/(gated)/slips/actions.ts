'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'
import { isRetryableStatus } from '@/lib/supabase/retryableStatus'

const ATTENDANCE_STATUSES = ['present', 'absent', 'half_day', 'holiday'] as const

export async function finalizeSlip(formData: FormData) {
  const organizationId = String(formData.get('organizationId') ?? '')
  const workerId = String(formData.get('workerId') ?? '')
  const weekStart = String(formData.get('weekStart') ?? '')
  const weekEnd = String(formData.get('weekEnd') ?? '')
  const finalAmount = Number(formData.get('finalAmount') ?? '')
  // Lands back on wherever this was submitted from — the standalone Weekly
  // Slips page, or the Dashboard's embedded view, which has no weekStart
  // param of its own (it only ever shows the current week).
  const returnTo = String(formData.get('returnTo') ?? '/dashboard/slips')

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
  redirect(`${returnTo}?${qs.toString()}`)
}

// Attendance is marked day-by-day as it happens rather than batch-submitted,
// so each day autosaves itself the moment it changes (see AttendanceGrid.tsx)
// instead of going through a single "Save attendance" form. No redirect here
// — this is called directly from a client component, and a full-page
// redirect on every field edit would be disruptive; revalidatePath is enough
// to refresh the server-rendered totals on the page that's already open.
// The DB trigger rejects the write if this day's week is already finalized;
// RLS separately restricts non-owner roles to writing only today's date.
export async function saveAttendanceDay(input: {
  organizationId: string
  workerId: string
  attendanceDate: string
  status: (typeof ATTENDANCE_STATUSES)[number]
  overtimeHours: number
  // null = pay overtime as overtimeHours x the derived hourly rate (the
  // default); a number = pay this flat amount instead, ignoring hours.
  overtimeWage: number | null
  holidayWage: number
}): Promise<{ error?: string; networkError?: boolean }> {
  if (!ATTENDANCE_STATUSES.includes(input.status)) return { error: 'Invalid attendance status' }

  const supabase = await createClient()
  const user = await getResilientUser(supabase)
  if (!user) return { error: 'Not signed in' }

  const overtimeHours = Number.isFinite(input.overtimeHours) && input.overtimeHours >= 0 ? input.overtimeHours : 0
  const overtimeWage =
    input.overtimeWage != null && Number.isFinite(input.overtimeWage) && input.overtimeWage >= 0
      ? input.overtimeWage
      : null
  const holidayWage = Number.isFinite(input.holidayWage) && input.holidayWage >= 0 ? input.holidayWage : 0

  const { error, status } = await supabase.from('attendance').upsert(
    {
      organization_id: input.organizationId,
      worker_id: input.workerId,
      attendance_date: input.attendanceDate,
      status: input.status,
      overtime_hours: overtimeHours,
      overtime_wage: overtimeWage,
      holiday_wage: holidayWage,
      created_by: user.id,
    },
    { onConflict: 'organization_id,worker_id,attendance_date' }
  )

  // See isRetryableStatus (lib/supabase/retryableStatus.ts) and the matching
  // FormState.networkError comment in entries/actions.ts.
  if (error) return { error: error.message, networkError: isRetryableStatus(status) }

  revalidatePath('/dashboard/slips')
  revalidatePath('/dashboard')
  return {}
}

export async function reopenSlip(formData: FormData) {
  const slipId = String(formData.get('slipId') ?? '')
  const workerId = String(formData.get('workerId') ?? '')
  const weekStart = String(formData.get('weekStart') ?? '')
  const returnTo = String(formData.get('returnTo') ?? '/dashboard/slips')

  const supabase = await createClient()
  const { error } = await supabase.rpc('reopen_weekly_slip', { p_slip_id: slipId })

  const qs = new URLSearchParams({ workerId, weekStart })
  if (error) qs.set('error', error.message)
  redirect(`${returnTo}?${qs.toString()}`)
}
