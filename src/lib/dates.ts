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
