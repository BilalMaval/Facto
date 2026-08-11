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
