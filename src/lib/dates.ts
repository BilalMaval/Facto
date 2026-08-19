export type WeekStartDay = 'monday' | 'saturday'

export function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

// Monday=1 ... Saturday=6 (JS getUTCDay: Sunday=0)
const ANCHOR_DAY: Record<WeekStartDay, number> = { monday: 1, saturday: 6 }

// The org-wide CURRENT scheme, as a short label — distinct from a specific
// slip's own weekTypeLabel (SlipView.tsx), which is derived from that
// week's own start date and so can show the org's PAST scheme for an old
// week, even after the org has since switched.
export const WEEK_SCHEME_LABEL: Record<WeekStartDay, string> = { monday: 'Mon-Sat', saturday: 'Sat-Thu' }

export function weekStartOf(dateStr: string, weekStartDay: WeekStartDay = 'monday') {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = d.getUTCDay()
  const diff = (day - ANCHOR_DAY[weekStartDay] + 7) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

export function currentWeekStart(weekStartDay: WeekStartDay = 'monday') {
  return weekStartOf(today(), weekStartDay)
}

// A pending Week Start Day change, as recorded on the organization: the
// scheme that was active *before* the change, and the last date it still
// governs. Absent (both null) once no change has ever happened, or once
// it's simply irrelevant to the date being resolved (see resolveWeekBounds).
export type WeekScheme = {
  weekStartDay: WeekStartDay
  previousWeekStartDay: WeekStartDay | null
  transitionDate: string | null
}

// The smallest date strictly after `afterDateStr` that itself anchors a
// week under `weekStartDay` (i.e. the next Monday, or next Saturday).
export function nextAnchorAfter(afterDateStr: string, weekStartDay: WeekStartDay): string {
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(afterDateStr, i)
    if (weekStartOf(candidate, weekStartDay) === candidate) return candidate
  }
  return addDays(afterDateStr, 7) // unreachable — a matching day-of-week always occurs within 7 days
}

// The smallest date ON OR after `dateStr` that itself anchors a week under
// `weekStartDay`. Unlike nextAnchorAfter, this recognizes `dateStr` itself
// as a valid anchor instead of always waiting a full week for the next one
// — needed so a scheme transition can start its first clean week the very
// same day, when that day already happens to be the new scheme's anchor day
// (e.g. switching to a Saturday-start scheme on a Saturday), instead of
// needlessly delaying it by a week.
export function nextAnchorOnOrAfter(dateStr: string, weekStartDay: WeekStartDay): string {
  return weekStartOf(dateStr, weekStartDay) === dateStr ? dateStr : nextAnchorAfter(dateStr, weekStartDay)
}

// The week (start + end) that `dateStr` falls into, aware of a scheme
// transition if one is recorded. Two zones:
//   - before the new scheme's first clean anchor day (the soonest date on or
//     after the transition that anchors a week under the new scheme):
//     classified under the OLD scheme, exactly as if nothing had changed —
//     this is what protects dates that already happened under the old
//     rules. The one week actually running when the switch happened is the
//     sole exception: it's cut short to end right before that clean anchor
//     instead of running its full natural length, so the two schedules
//     never overlap or leave a gap.
//   - on/after that clean anchor day: perfectly normal weeks under the new
//     scheme, forever after.
// With no transition recorded, this is just weekStartOf + a flat 7-day span.
export function resolveWeekBounds(
  dateStr: string,
  scheme: WeekScheme
): { weekStart: string; weekEnd: string } {
  const { weekStartDay, previousWeekStartDay, transitionDate } = scheme
  if (previousWeekStartDay && transitionDate) {
    const cleanAnchor = nextAnchorOnOrAfter(transitionDate, weekStartDay)
    if (dateStr < cleanAnchor) {
      const weekStart = weekStartOf(dateStr, previousWeekStartDay)
      const naturalWeekEnd = addDays(weekStart, 6)
      // A week that would naturally end before the new scheme's clean
      // anchor is untouched; the one that would otherwise run into or past
      // it is cut short to end the day before instead.
      const weekEnd = naturalWeekEnd < cleanAnchor ? naturalWeekEnd : addDays(cleanAnchor, -1)
      return { weekStart, weekEnd }
    }
  }
  const weekStart = weekStartOf(dateStr, weekStartDay)
  return { weekStart, weekEnd: addDays(weekStart, 6) }
}

// The week bounds for "right now," transition-aware — the replacement for
// naive `{ weekStart: currentWeekStart(...), weekEnd: addDays(weekStart, 6) }`
// wherever a pending transition needs to be respected.
export function currentWeekBounds(scheme: WeekScheme) {
  return resolveWeekBounds(today(), scheme)
}

// Number of calendar days spanned by [startStr, endStr] inclusive — 7 for a
// normal week, fewer for a short bridge week.
export function daySpan(startStr: string, endStr: string): number {
  return Math.round((Date.parse(`${endStr}T00:00:00Z`) - Date.parse(`${startStr}T00:00:00Z`)) / 86400000) + 1
}

export function formatTime(isoString: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(
    new Date(isoString)
  )
}

export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'DD-MM-YYYY' | 'DD MMM YYYY'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// dateStr is always a plain YYYY-MM-DD calendar date (entry_date,
// payment_date, week_start, …) — reformatted for display only, per the
// org's own date_format preference. Native <input type="date"> pickers
// still render in the browser's own locale format; only text/table
// displays go through this.
export function formatDate(dateStr: string, format: DateFormat) {
  const [y, m, d] = dateStr.split('-')
  switch (format) {
    case 'DD/MM/YYYY':
      return `${d}/${m}/${y}`
    case 'MM/DD/YYYY':
      return `${m}/${d}/${y}`
    case 'DD-MM-YYYY':
      return `${d}-${m}-${y}`
    case 'DD MMM YYYY':
      return `${d} ${MONTH_ABBR[Number(m) - 1]} ${y}`
    default:
      return dateStr
  }
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayAbbr(dateStr: string) {
  return DAY_ABBR[new Date(`${dateStr}T00:00:00Z`).getUTCDay()]
}
