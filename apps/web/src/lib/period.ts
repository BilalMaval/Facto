import { addDays, formatDate, weekStartOf, type DateFormat, type WeekStartDay } from './dates'

export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export function periodRange(
  period: Period,
  date: string,
  startDate?: string,
  endDate?: string,
  weekStartDay: WeekStartDay = 'monday'
): { start: string; end: string } {
  if (period === 'custom') {
    const start = startDate || date
    const end = endDate || start
    return start <= end ? { start, end } : { start: end, end: start }
  }

  if (period === 'weekly') {
    const start = weekStartOf(date, weekStartDay)
    return { start, end: addDays(start, 6) }
  }

  if (period === 'monthly') {
    const [y, m] = date.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { start, end }
  }

  if (period === 'yearly') {
    const y = date.slice(0, 4)
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }

  return { start: date, end: date }
}

export function periodLabel(
  period: Period,
  range: { start: string; end: string },
  dateFormat: DateFormat
): string {
  if (range.start === range.end) return formatDate(range.start, dateFormat)
  return `${formatDate(range.start, dateFormat)} to ${formatDate(range.end, dateFormat)}`
}
