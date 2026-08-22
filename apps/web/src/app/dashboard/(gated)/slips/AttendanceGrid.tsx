'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, dayAbbr, daySpan, formatDate, type DateFormat } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { saveAttendanceDay } from './actions'

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'holiday'

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half-day',
  holiday: 'Holiday',
}
const STATUS_DAY_VALUE: Record<AttendanceStatus, number> = {
  present: 1,
  absent: 0,
  half_day: 0.5,
  holiday: 0,
}
const REGULAR_DAY_STATUSES: AttendanceStatus[] = ['present', 'absent', 'half_day']
// The LAST day of a full 7-day grid defaults to the org's day off (Friday
// for Saturday-start weeks, Sunday for Monday-start weeks) — see dates.ts:
// whichever day anchors the week, it lands last in a 7-day span starting
// from that anchor. A shortened week spanning a Week Start Day change
// (fewer than 7 days, see resolveWeekBounds) never reaches that real day
// off — every day in it is a genuine working day — so holidayIndex is -1
// for one instead, and no row gets treated as the holiday row.
const HOLIDAY_DAY_STATUSES: AttendanceStatus[] = ['holiday', 'present', 'absent', 'half_day']

type DayRow = {
  status: AttendanceStatus
  overtimeHours: string
  // When true, overtimeWage is a flat amount typed directly for the day,
  // overriding the usual hours x rate calc — for cases that don't map
  // cleanly to an hourly rate (a fixed bonus, a negotiated one-off amount).
  overtimeCustom: boolean
  overtimeWage: string
  holidayWage: string
  // True once this row has an actual row in the database — either loaded
  // from existingRows, or written by the mount-time auto-save below (most
  // days default to Present and there's no reason to force an explicit
  // no-op edit before that counts toward pay) or by an explicit change.
  // Only persisted rows count toward the summary math, so it stays in sync
  // with the server-computed Total Work below this grid.
  persisted: boolean
}
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function AttendanceGrid({
  organizationId,
  workerId,
  weekStart,
  weekEnd,
  dateFormat,
  existingRows,
  weeklySalary,
  standardDaysPerWeek,
  standardHoursPerDay,
  overtimeRateMultiplier,
  currency,
  showDecimals,
  weekFinalized,
  today,
  canEditPastDays,
}: {
  organizationId: string
  workerId: string
  weekStart: string
  weekEnd: string
  dateFormat: DateFormat
  existingRows: {
    attendance_date: string
    status: string
    overtime_hours: number
    overtime_wage: number | null
    holiday_wage: number
  }[]
  weeklySalary: number
  standardDaysPerWeek: number
  standardHoursPerDay: number
  overtimeRateMultiplier: number
  currency: string
  showDecimals: boolean
  // Whole week is locked once finalized — must be reopened before any day
  // can be edited again, regardless of role.
  weekFinalized: boolean
  today: string
  // Owner can edit any day; admin/staff can only edit today's row —
  // attendance is meant to be marked as it happens, not batch-corrected
  // later. Enforced again server-side (and at the RLS layer), this only
  // controls what the UI offers.
  canEditPastDays: boolean
}) {
  // Normally 7, but a shortened week spanning a Week Start Day change (see
  // lib/dates.ts) has fewer — the grid itself and the per-day rate math
  // (weeklySalary / standardDaysPerWeek) work unchanged for a shorter span,
  // since nothing here hardcodes a week length beyond this one array.
  const dayCount = useMemo(() => daySpan(weekStart, weekEnd), [weekStart, weekEnd])
  // A shortened week never reaches its real day off (see resolveWeekBounds)
  // — every day in it is a genuine working day, so there's no holiday row at
  // all. holidayIndex = -1 makes every `i === holidayIndex` check below
  // naturally false for such a week, without needing a separate flag.
  const hasDayOff = dayCount === 7
  const holidayIndex = hasDayOff ? dayCount - 1 : -1
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i)),
    [weekStart, dayCount]
  )
  const existingByDate = useMemo(() => {
    const map = new Map<
      string,
      { status: string; overtime_hours: number; overtime_wage: number | null; holiday_wage: number }
    >()
    for (const r of existingRows) map.set(r.attendance_date, r)
    return map
  }, [existingRows])

  const [rows, setRows] = useState<DayRow[]>(() =>
    days.map((d, i) => {
      const existing = existingByDate.get(d)
      return {
        status: (existing?.status as AttendanceStatus) ?? (i === holidayIndex ? 'holiday' : 'present'),
        overtimeHours: existing ? String(existing.overtime_hours) : '0',
        overtimeCustom: existing?.overtime_wage != null,
        overtimeWage: existing?.overtime_wage != null ? String(existing.overtime_wage) : '0',
        holidayWage: existing ? String(existing.holiday_wage) : '0',
        persisted: existing != null,
      }
    })
  )
  const [saveState, setSaveState] = useState<Record<number, SaveState>>({})
  const [errorByIndex, setErrorByIndex] = useState<Record<number, string>>({})
  const [, startTransition] = useTransition()
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didAutoSaveDefaults = useRef(false)
  const router = useRouter()

  // Several rows can each finish saving within milliseconds of each other —
  // most notably the mount-time default-save below, which can fire up to 7
  // saves at once. Each one independently calling router.refresh() turned
  // into a burst of concurrent refreshes that was heavy enough to race the
  // session-cookie refresh and log the user out. Coalescing them into one
  // refresh, fired shortly after the last save in a batch settles, keeps the
  // "totals catch up automatically" behavior without the request storm.
  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null
      router.refresh()
    }, 300)
  }

  // `rows` only seeds itself from `existingRows` once, on mount — a plain
  // useState initializer never re-runs just because props changed. If this
  // exact component instance stays mounted across a client-side navigation
  // (leaving the tab, coming back later, browser back/forward, etc.) without
  // fully remounting, it can keep showing what it looked like when it first
  // mounted even though the server-rendered numbers elsewhere on the page
  // (Total Work) have since refetched fresh data — a full page reload
  // "fixes" it only because that forces a genuine remount. This effect
  // re-syncs every row to the latest existingRows whenever that prop
  // changes, skipping any row with a pending debounced save so it can't
  // stomp on something the user is actively mid-typing.
  useEffect(() => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (debounceTimers.current[i]) return row
        const existing = existingByDate.get(days[i])
        if (!existing) return row
        return {
          status: existing.status as AttendanceStatus,
          overtimeHours: String(existing.overtime_hours),
          overtimeCustom: existing.overtime_wage != null,
          overtimeWage: existing.overtime_wage != null ? String(existing.overtime_wage) : row.overtimeWage,
          holidayWage: String(existing.holiday_wage),
          persisted: true,
        }
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingByDate])

  const perDayRate = standardDaysPerWeek > 0 ? weeklySalary / standardDaysPerWeek : 0
  const overtimeHourlyRate = standardHoursPerDay > 0 ? (perDayRate / standardHoursPerDay) * overtimeRateMultiplier : 0

  function overtimeAmountFor(r: DayRow) {
    return r.overtimeCustom ? parseFloat(r.overtimeWage) || 0 : (parseFloat(r.overtimeHours) || 0) * overtimeHourlyRate
  }

  function rowEditable(i: number) {
    return !weekFinalized && (canEditPastDays || days[i] === today)
  }

  function saveRow(i: number, row: DayRow) {
    setErrorByIndex((prev) => {
      if (!(i in prev)) return prev
      const next = { ...prev }
      delete next[i]
      return next
    })
    setSaveState((prev) => ({ ...prev, [i]: 'saving' }))
    startTransition(async () => {
      const result = await saveAttendanceDay({
        organizationId,
        workerId,
        attendanceDate: days[i],
        status: row.status,
        overtimeHours: parseFloat(row.overtimeHours) || 0,
        overtimeWage: row.overtimeCustom ? parseFloat(row.overtimeWage) || 0 : null,
        holidayWage: parseFloat(row.holidayWage) || 0,
      })
      if (result.error) {
        setSaveState((prev) => ({ ...prev, [i]: 'error' }))
        setErrorByIndex((prev) => ({ ...prev, [i]: result.error! }))
      } else {
        setSaveState((prev) => ({ ...prev, [i]: 'saved' }))
        updateRow(i, { persisted: true })
        // revalidatePath in the action only marks the server-rendered totals
        // (Total Work/Payable below this grid) stale — it doesn't repaint
        // this already-mounted page on its own. Without this, they'd only
        // catch up whenever some unrelated navigation happened to refetch,
        // which read as "delayed" and occasionally dropped a day's amount
        // if two saves landed close together and only the last one won a
        // refresh.
        scheduleRefresh()
      }
    })
  }

  function updateRow(i: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  // Commit each row's default the moment the grid loads, for whichever days
  // the viewer is actually allowed to write (their own today, or any day
  // for the owner — RLS would reject the rest anyway, so this only ever
  // attempts writes that would succeed). Without this, a day nobody ever
  // touched — even though its default of Present was correct all along —
  // never made it into the database, which is exactly what produced the
  // mismatch between this grid's live total and the server-computed Total
  // Work below it. The status can still be changed same-day afterward.
  useEffect(() => {
    // React Strict Mode (dev only) intentionally runs mount effects twice to
    // surface missing-cleanup bugs; without this guard that meant up to 14
    // concurrent save+refresh calls instead of 7 — exactly the kind of burst
    // that caused the request storm above.
    if (didAutoSaveDefaults.current) return
    didAutoSaveDefaults.current = true
    rows.forEach((row, i) => {
      if (!row.persisted && rowEditable(i)) saveRow(i, row)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleStatusChange(i: number, status: AttendanceStatus) {
    const next = { ...rows[i], status }
    updateRow(i, { status })
    saveRow(i, next)
  }

  function handleOvertimeModeToggle(i: number, custom: boolean) {
    const current = rows[i]
    // Pre-fill the custom field with what the hours-based calc would've
    // paid, so switching to "custom" is a starting point to adjust from
    // rather than a blank field that silently zeroes out the day's overtime
    // until the user notices. Only pre-fills if nothing was typed there
    // before — flipping back and forth keeps whatever custom amount was
    // last entered.
    const wage =
      custom && current.overtimeWage === '0' ? String(overtimeAmountFor({ ...current, overtimeCustom: false })) : current.overtimeWage
    const next: DayRow = { ...current, overtimeCustom: custom, overtimeWage: wage }
    updateRow(i, { overtimeCustom: custom, overtimeWage: wage })
    saveRow(i, next)
  }

  function handleNumberChange(i: number, field: 'overtimeHours' | 'overtimeWage' | 'holidayWage', value: string) {
    const next = { ...rows[i], [field]: value }
    updateRow(i, { [field]: value })
    if (debounceTimers.current[i]) clearTimeout(debounceTimers.current[i])
    debounceTimers.current[i] = setTimeout(() => saveRow(i, next), 600)
  }

  function handleNumberBlur(i: number) {
    if (debounceTimers.current[i]) {
      clearTimeout(debounceTimers.current[i])
      delete debounceTimers.current[i]
    }
    saveRow(i, rows[i])
  }

  // Mirrors SlipView's server-side calc exactly: nothing saved yet for this
  // week falls back to the flat weekly salary, and once anything has been
  // saved, only the saved rows count — an unconfirmed default (see the
  // DayRow.persisted comment) contributes nothing, same as on the server.
  const anyPersisted = rows.some((r) => r.persisted)
  const regularDaysSum = rows.reduce(
    (sum, r, i) => (i === holidayIndex || !r.persisted ? sum : sum + STATUS_DAY_VALUE[r.status]),
    0
  )
  const overtimeAmountSum = rows.reduce((sum, r) => (r.persisted ? sum + overtimeAmountFor(r) : sum), 0)
  const holidayWageValue =
    holidayIndex >= 0 && rows[holidayIndex].persisted && rows[holidayIndex].status === 'present'
      ? parseFloat(rows[holidayIndex].holidayWage) || 0
      : 0
  const salaryComponent = anyPersisted
    ? regularDaysSum * perDayRate + overtimeAmountSum + holidayWageValue
    : weeklySalary

  const anyLockedByDayRule = !weekFinalized && !canEditPastDays && days.some((d) => d !== today)

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-zinc-700">Attendance</h3>
      <div className="mt-2 overflow-x-auto print:overflow-visible">
        {/* table-fixed + explicit column widths so a value changing width as
            you type (an hours digit, a save-state badge) reflows only its
            own cell, not the whole table — without this every row's columns
            kept resizing to fit whatever was momentarily longest. */}
        <table className="w-full min-w-[560px] table-fixed text-sm print:min-w-0">
          <thead>
            <tr className="border-b border-zinc-300 text-left">
              <th className="w-[8%] py-2 pr-2">Day</th>
              <th className="w-[15%] py-2 pr-2">Date</th>
              <th className="w-[22%] py-2 px-2">Status</th>
              <th className="w-[35%] py-2 px-2">Overtime</th>
              <th className="w-[20%] py-2 pl-2">Holiday wage</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => {
              const isHolidayRow = i === holidayIndex
              const editable = rowEditable(i)
              const state = saveState[i] ?? 'idle'
              const row = rows[i]
              return (
                <tr key={d} className={`border-b border-zinc-100 ${isHolidayRow ? 'bg-sky-50/70' : ''}`}>
                  <td className="py-2 pr-2">
                    {dayAbbr(d)}
                    {isHolidayRow && <span className="ml-1 text-[10px] font-medium text-sky-600">Day off</span>}
                  </td>
                  <td className="py-2 pr-2 whitespace-nowrap">{formatDate(d, dateFormat)}</td>
                  <td className="py-2 px-2">
                    {/* Printed slips show plain text regardless of edit
                        state — a <select>/<input> control prints as a form
                        widget, not something that reads as a filled-in slip. */}
                    <span className="print:hidden">
                      {editable ? (
                        <select
                          value={row.status}
                          onChange={(e) => handleStatusChange(i, e.target.value as AttendanceStatus)}
                          className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                        >
                          {(isHolidayRow ? HOLIDAY_DAY_STATUSES : REGULAR_DAY_STATUSES).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        STATUS_LABELS[row.status]
                      )}
                    </span>
                    <span className="hidden print:inline">{STATUS_LABELS[row.status]}</span>
                    {/* Always renders one line of text (invisible when idle)
                        so the row's height stays constant whether or not a
                        save badge is showing — a badge popping in and out of
                        the flow was one of the sources of the layout jitter.
                        Screen-only: a live save-in-progress indicator has no
                        meaning on a printed page. */}
                    <span
                      className={`mt-0.5 block h-4 truncate text-[11px] print:hidden ${
                        state === 'saving'
                          ? 'text-zinc-400'
                          : state === 'saved'
                            ? 'text-emerald-600'
                            : state === 'error'
                              ? 'text-red-600'
                              : 'invisible'
                      }`}
                    >
                      {state === 'saving'
                        ? 'Saving…'
                        : state === 'saved'
                          ? 'Saved'
                          : state === 'error'
                            ? (errorByIndex[i] ?? 'Save failed')
                            : 'Saved'}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <span className="print:hidden">
                      {editable ? (
                        row.overtimeCustom ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={row.overtimeWage}
                              onChange={(e) => handleNumberChange(i, 'overtimeWage', e.target.value)}
                              onBlur={() => handleNumberBlur(i)}
                              placeholder="Amount"
                              className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                            />
                            <span className="text-[10px] font-medium text-amber-600">Custom</span>
                            <button
                              type="button"
                              onClick={() => handleOvertimeModeToggle(i, false)}
                              className="text-[10px] text-zinc-400 underline hover:text-zinc-600"
                            >
                              Use hours
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={row.overtimeHours}
                              onChange={(e) => handleNumberChange(i, 'overtimeHours', e.target.value)}
                              onBlur={() => handleNumberBlur(i)}
                              className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                            />
                            <span className="min-w-[64px] shrink-0 text-[10px] whitespace-nowrap tabular-nums text-zinc-400">
                              hrs = {formatMoney(overtimeAmountFor(row), currency, showDecimals)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOvertimeModeToggle(i, true)}
                              className="text-[10px] text-zinc-400 underline hover:text-zinc-600"
                            >
                              Custom
                            </button>
                          </div>
                        )
                      ) : row.overtimeCustom ? (
                        <>
                          {formatMoney(row.overtimeWage, currency, showDecimals)}{' '}
                          <span className="text-[10px] font-medium text-amber-600">Custom</span>
                        </>
                      ) : (
                        `${row.overtimeHours} hrs = ${formatMoney(overtimeAmountFor(row), currency, showDecimals)}`
                      )}
                    </span>
                    <span className="hidden print:inline">
                      {row.overtimeCustom
                        ? `${formatMoney(row.overtimeWage, currency, showDecimals)} (Custom)`
                        : `${row.overtimeHours} hrs = ${formatMoney(overtimeAmountFor(row), currency, showDecimals)}`}
                    </span>
                  </td>
                  <td className="py-2 pl-2">
                    <span className="print:hidden">
                      {isHolidayRow && row.status === 'present' ? (
                        editable ? (
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={row.holidayWage}
                            onChange={(e) => handleNumberChange(i, 'holidayWage', e.target.value)}
                            onBlur={() => handleNumberBlur(i)}
                            placeholder="Wage for this day"
                            className="w-32 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          formatMoney(row.holidayWage, currency, showDecimals)
                        )
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </span>
                    <span className="hidden print:inline">
                      {isHolidayRow && row.status === 'present' ? formatMoney(row.holidayWage, currency, showDecimals) : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        {anyPersisted ? (
          <>
            Days present: {regularDaysSum} / {standardDaysPerWeek} standard · Overtime:{' '}
            {formatMoney(overtimeAmountSum, currency, showDecimals)}
            {holidayWageValue > 0 && (
              <> · Holiday pay: {formatMoney(holidayWageValue, currency, showDecimals)}</>
            )}{' '}
            · Salary component: {formatMoney(salaryComponent, currency, showDecimals)}
          </>
        ) : (
          <>
            No attendance marked yet this week — salary component defaults to the full weekly salary:{' '}
            {formatMoney(salaryComponent, currency, showDecimals)}
          </>
        )}
      </p>

      {weekFinalized ? (
        <p className="mt-1 text-xs text-zinc-400 print:hidden">
          This week is finalized — reopen it to edit attendance.
        </p>
      ) : anyLockedByDayRule ? (
        <p className="mt-1 text-xs text-zinc-400 print:hidden">
          Only today&apos;s attendance can be marked here. Past days can be edited by the business owner.
        </p>
      ) : null}
    </div>
  )
}
