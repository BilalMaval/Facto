import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { getOwnerTier } from '@/lib/ownerPlan'
import { createClient } from '@/lib/supabase/server'
import { currentWeekBounds, resolveWeekBounds, type WeekScheme, type WeekStartDay } from '@/lib/dates'
import { switchActiveOrganization } from '../../actions'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage() {
  const { user, membership, memberships } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') redirect('/dashboard')

  const org = membership.organization
  const tier = await getOwnerTier(user.id)
  const addBusinessHref = tier === 'premium' ? '/dashboard/settings/new-business' : '/dashboard/settings/upgrade'
  const scheme: WeekScheme = {
    weekStartDay: org.week_start_day as WeekStartDay,
    previousWeekStartDay: org.week_scheme_previous_start_day as WeekStartDay | null,
    transitionDate: org.week_scheme_transition_date,
  }
  const openPastWeeksCount = await countOpenPastWeeks(org.id, scheme)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">Organization-wide settings for {org.name}.</p>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-700">Your businesses</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {tier === 'premium'
            ? 'Multi-business access is enabled — manage as many businesses as you need.'
            : 'You can currently manage one business. Unlock multi-business access to add more.'}
        </p>

        <div className="mt-4 space-y-2">
          {memberships.map((m) => (
            <div
              key={m.organizationId}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900">{m.orgName}</p>
                <p className="text-xs text-zinc-500">{m.role}</p>
              </div>
              {m.organizationId === org.id ? (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
                  Current
                </span>
              ) : (
                <form action={switchActiveOrganization}>
                  <input type="hidden" name="organizationId" value={m.organizationId} />
                  <button type="submit" className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900">
                    Switch
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <Link
          href={addBusinessHref}
          className="mt-4 inline-block rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          + Add another business
        </Link>
      </div>

      <div className="mt-6">
        <SettingsForm
          organizationId={org.id}
          currentWeekStartDay={org.week_start_day}
          currentTimezone={org.timezone}
          currentCurrency={org.currency}
          currentDateFormat={org.date_format}
          currentShowDecimals={org.show_decimals}
          currentStandardDaysPerWeek={org.standard_days_per_week}
          currentStandardHoursPerDay={org.standard_hours_per_day}
          currentOvertimeRateMultiplier={org.overtime_rate_multiplier}
          openPastWeeksCount={openPastWeeksCount}
        />
      </div>
    </div>
  )
}

// Weeks before the current one that still have real (entries/payments/
// attendance) data but were never finalized — either never finalized at
// all, or explicitly reopened (status='draft') and not yet re-finalized.
// Changing Week Start Day never touches or loses this data, but it does
// change which "week" a date is grouped into going forward, so a week like
// this stops showing up via the Weekly Slips ‹ › navigation afterward (you'd
// need Find weekly slip records to open it again) — worth flagging before
// the org owner switches.
async function countOpenPastWeeks(organizationId: string, scheme: WeekScheme) {
  const supabase = await createClient()
  const cutoff = currentWeekBounds(scheme).weekStart

  const [{ data: draftSlips }, { data: finalizedSlips }, { data: entryRows }, { data: paymentRows }, { data: attendanceRows }] =
    await Promise.all([
      supabase
        .from('weekly_slips')
        .select('worker_id, week_start')
        .eq('organization_id', organizationId)
        .eq('status', 'draft'),
      supabase
        .from('weekly_slips')
        .select('worker_id, week_start')
        .eq('organization_id', organizationId)
        .eq('status', 'finalized'),
      supabase
        .from('work_entries')
        .select('worker_id, counted_week_start')
        .eq('organization_id', organizationId)
        .lt('counted_week_start', cutoff),
      supabase
        .from('payments')
        .select('worker_id, counted_week_start')
        .eq('organization_id', organizationId)
        .lt('counted_week_start', cutoff),
      supabase
        .from('attendance')
        .select('worker_id, attendance_date')
        .eq('organization_id', organizationId)
        .lt('attendance_date', cutoff),
    ])

  const finalizedKeys = new Set((finalizedSlips ?? []).map((s) => `${s.worker_id}|${s.week_start}`))
  const openWeekKeys = new Set<string>()

  for (const row of draftSlips ?? []) openWeekKeys.add(`${row.worker_id}|${row.week_start}`)
  for (const row of entryRows ?? []) {
    const key = `${row.worker_id}|${row.counted_week_start}`
    if (!finalizedKeys.has(key)) openWeekKeys.add(key)
  }
  for (const row of paymentRows ?? []) {
    const key = `${row.worker_id}|${row.counted_week_start}`
    if (!finalizedKeys.has(key)) openWeekKeys.add(key)
  }
  for (const row of attendanceRows ?? []) {
    const weekStart = resolveWeekBounds(row.attendance_date, scheme).weekStart
    const key = `${row.worker_id}|${weekStart}`
    if (!finalizedKeys.has(key)) openWeekKeys.add(key)
  }

  return openWeekKeys.size
}
