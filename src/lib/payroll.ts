import { daySpan } from './dates'

const STATUS_DAY_VALUE: Record<string, number> = { present: 1, half_day: 0.5, absent: 0, holiday: 0 }

export type AttendanceRow = {
  attendance_date: string
  status: string
  overtime_hours: number | null
  overtime_wage: number | null
  holiday_wage: number | null
}

// The attendance-driven component of a salary/hybrid worker's pay for one
// week: present/half-day/absent days at a per-day rate derived from
// weekly_salary, plus overtime on top, plus a separately-entered flat
// holiday_wage if the day off was actually worked. Falls back to the flat
// weekly_salary when no attendance has been logged for the week at all, so
// an org that hasn't started using attendance tracking isn't silently paid
// nothing. Mirrors finalize_weekly_slip() exactly — see the
// attendance_holiday_and_daily_edit and week_scheme_transition_holiday_fix
// migrations.
export function computeSalaryComponent(params: {
  weeklySalary: number | null
  attendanceRows: AttendanceRow[]
  weekStart: string
  weekEnd: string
  standardDaysPerWeek: number
  standardHoursPerDay: number
  overtimeRateMultiplier: number
}): number {
  const { weeklySalary, attendanceRows, weekStart, weekEnd, standardDaysPerWeek, standardHoursPerDay, overtimeRateMultiplier } =
    params
  const salary = weeklySalary != null ? Number(weeklySalary) : 0
  if (attendanceRows.length === 0) return salary

  const perDayRate = standardDaysPerWeek > 0 ? salary / standardDaysPerWeek : 0
  const overtimeHourlyRate = standardHoursPerDay > 0 ? (perDayRate / standardHoursPerDay) * overtimeRateMultiplier : 0
  // In a full 7-day week, the last day is the org's day off by default —
  // excluded from the regular present/absent/half-day sum. A shortened week
  // spanning a Week Start Day change never reaches that real day off, so
  // every day in it counts toward the regular sum instead.
  const hasDayOff = daySpan(weekStart, weekEnd) === 7

  const daysSum = attendanceRows
    .filter((a) => !hasDayOff || a.attendance_date !== weekEnd)
    .reduce((sum, a) => sum + (STATUS_DAY_VALUE[a.status] ?? 0), 0)

  const overtimeAmount = attendanceRows.reduce(
    (sum, a) =>
      sum + (a.overtime_wage != null ? Number(a.overtime_wage) : Number(a.overtime_hours ?? 0) * overtimeHourlyRate),
    0
  )

  const holidayWage = hasDayOff
    ? attendanceRows
        .filter((a) => a.attendance_date === weekEnd && a.status === 'present')
        .reduce((sum, a) => sum + Number(a.holiday_wage ?? 0), 0)
    : 0

  return daysSum * perDayRate + overtimeAmount + holidayWage
}

// What counts as "work" depends on how the worker is paid: contract workers
// are paid for entries logged, salary workers get the attendance-driven
// component alone, hybrid workers get both.
export function computeWorkAmount(params: {
  employmentType: string
  entriesAmount: number
  salaryComponent: number
}): number {
  const { employmentType, entriesAmount, salaryComponent } = params
  return employmentType === 'salary'
    ? salaryComponent
    : employmentType === 'hybrid'
      ? entriesAmount + salaryComponent
      : entriesAmount
}
