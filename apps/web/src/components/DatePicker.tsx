'use client'

import { useEffect, useRef, useState } from 'react'
import { formatDate, today as todayStr, type DateFormat } from '@/lib/dates'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

type Segment = 'Y' | 'M' | 'D'
// Order/width of each date component per format, plus the separator typed
// between them — drives both the auto-inserted-separator typing mask below
// and parsing typed digits back into a real date. Month is always typed
// numerically even for 'DD MMM YYYY' (typing letters for a month name
// character-by-character isn't something a simple mask can help with) — the
// real month name only shows once the field isn't focused, via formatDate.
const FORMAT_SEGMENTS: Record<DateFormat, { order: Segment[]; widths: number[]; sep: string }> = {
  'YYYY-MM-DD': { order: ['Y', 'M', 'D'], widths: [4, 2, 2], sep: '-' },
  'DD/MM/YYYY': { order: ['D', 'M', 'Y'], widths: [2, 2, 4], sep: '/' },
  'MM/DD/YYYY': { order: ['M', 'D', 'Y'], widths: [2, 2, 4], sep: '/' },
  'DD-MM-YYYY': { order: ['D', 'M', 'Y'], widths: [2, 2, 4], sep: '-' },
  'DD MMM YYYY': { order: ['D', 'M', 'Y'], widths: [2, 2, 4], sep: ' ' },
}

function totalDigitsFor(fmt: DateFormat) {
  return FORMAT_SEGMENTS[fmt].widths.reduce((a, b) => a + b, 0)
}

// Inserts separators as digits accumulate — never a trailing separator, so
// mid-segment typing ("15/0") doesn't look like a finished field.
function maskDigits(digits: string, fmt: DateFormat) {
  const { widths, sep } = FORMAT_SEGMENTS[fmt]
  const capped = digits.slice(0, totalDigitsFor(fmt))
  const parts: string[] = []
  let pos = 0
  for (const w of widths) {
    const part = capped.slice(pos, pos + w)
    if (!part) break
    parts.push(part)
    pos += w
    if (part.length < w) break
  }
  return parts.join(sep)
}

// Only resolves once every segment is fully typed — partial input just
// keeps displaying the mask without touching the caller's value yet.
function digitsToISO(digits: string, fmt: DateFormat): string | null {
  const { order, widths } = FORMAT_SEGMENTS[fmt]
  if (digits.length !== totalDigitsFor(fmt)) return null
  const values: Record<Segment, number> = { Y: 0, M: 0, D: 0 }
  let pos = 0
  for (let i = 0; i < order.length; i++) {
    const w = widths[i]
    values[order[i]] = Number(digits.slice(pos, pos + w))
    pos += w
  }
  const { Y: year, M: month, D: day } = values
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000) return null
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const d = new Date(`${iso}T00:00:00Z`)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null
  return iso
}

function isoToDigits(iso: string, fmt: DateFormat) {
  const { year, month, day } = parseISO(iso)
  const { order } = FORMAT_SEGMENTS[fmt]
  const map: Record<Segment, string> = {
    Y: String(year).padStart(4, '0'),
    M: String(month).padStart(2, '0'),
    D: String(day).padStart(2, '0'),
  }
  return order.map((s) => map[s]).join('')
}

// Applied to the field's wrapper div (not a real form control, so the
// `disabled:`/`focus:` pseudo-class variants Tailwind normally relies on
// don't apply here — disabled/focus styling is toggled via plain
// conditionals in the component instead). Deliberately no `transition-*` on
// box-shadow: animating from `none` to the ring's var()-based multi-layer
// box-shadow left it permanently stuck fully transparent in testing (every
// underlying `--tw-ring-*` custom property still resolved correctly on
// inspection — only the rendered box-shadow itself broke), so the ring
// appears instantly instead.
const WRAPPER_BASE_CLASSES =
  'flex w-full items-center gap-1 rounded-md border border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-900'

function parseISO(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}

function buildGrid(viewYear: number, viewMonth: number) {
  const first = new Date(Date.UTC(viewYear, viewMonth - 1, 1))
  const gridStart = new Date(first)
  gridStart.setUTCDate(gridStart.getUTCDate() - first.getUTCDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setUTCDate(gridStart.getUTCDate() + i)
    return {
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === viewMonth - 1,
    }
  })
}

// Native <input type="date"> renders its text and popup calendar in the
// browser/OS locale format — that's not something CSS or JS can override.
// This is a from-scratch replacement so the org's date_format preference is
// actually honored everywhere a date is displayed or picked, not just in
// text/table displays. The field itself is a typeable text input (digits
// auto-mask into the right separators as you type, so you never have to
// type the "/" or "-" yourself) — the calendar dropdown is a separate,
// explicit affordance via the trailing icon button, not something that
// pops open just from interacting with the field.
export function DatePicker({
  name,
  value,
  onChange,
  dateFormat,
  id,
  disabled,
  min,
  max,
  placeholder = 'Select date',
  className,
}: {
  name?: string
  value: string
  onChange: (value: string) => void
  dateFormat: DateFormat
  id?: string
  disabled?: boolean
  min?: string
  max?: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [typedDigits, setTypedDigits] = useState('')
  const seed = parseISO(value || todayStr())
  const [viewYear, setViewYear] = useState(seed.year)
  const [viewMonth, setViewMonth] = useState(seed.month)
  const containerRef = useRef<HTMLDivElement>(null)

  function openCalendar() {
    const seedOnOpen = parseISO(value || todayStr())
    setViewYear(seedOnOpen.year)
    setViewMonth(seedOnOpen.month)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function shiftMonth(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setViewMonth(m)
    setViewYear(y)
  }

  function handleTextFocus(e: React.FocusEvent<HTMLInputElement>) {
    setTyping(true)
    setTypedDigits(value ? isoToDigits(value, dateFormat) : '')
    e.target.select()
  }

  function handleTextBlur() {
    setTyping(false)
    setTypedDigits('')
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, totalDigitsFor(dateFormat))
    setTypedDigits(digits)
    const iso = digitsToISO(digits, dateFormat)
    if (iso && (!min || iso >= min) && (!max || iso <= max)) onChange(iso)
  }

  const currentYear = new Date().getUTCFullYear()
  const yearOptions = Array.from({ length: 111 }, (_, i) => currentYear + 10 - i)
  const cells = buildGrid(viewYear, viewMonth)
  const displayValue = typing ? maskDigits(typedDigits, dateFormat) : value ? formatDate(value, dateFormat) : ''

  return (
    <div ref={containerRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <div className={`${WRAPPER_BASE_CLASSES} ${disabled ? 'bg-zinc-50' : ''} ${className ?? ''}`}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          id={id}
          disabled={disabled}
          value={displayValue}
          onChange={handleTextChange}
          onFocus={handleTextFocus}
          onBlur={handleTextBlur}
          placeholder={placeholder}
          className={`min-w-0 flex-1 appearance-none bg-transparent py-2 pl-3 text-sm outline-none placeholder:text-zinc-400 ${disabled ? 'text-zinc-500' : ''}`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openCalendar())}
          aria-label="Open calendar"
          className="flex shrink-0 items-center py-2 pr-3 text-zinc-400 hover:text-zinc-600 disabled:text-zinc-300"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M3 8h14M6.5 3v3M13.5 3v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-64 rounded-md border border-zinc-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded px-2 py-1 text-sm hover:bg-zinc-100"
            >
              ‹
            </button>
            <div className="flex gap-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="rounded border border-zinc-200 py-0.5 text-xs"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="rounded border border-zinc-200 py-0.5 text-xs"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded px-2 py-1 text-sm hover:bg-zinc-100"
            >
              ›
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[11px] text-zinc-400">
            {DAY_HEADERS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {cells.map((c) => {
              const outOfRange = (min != null && c.iso < min) || (max != null && c.iso > max)
              const selected = c.iso === value
              return (
                <button
                  type="button"
                  key={c.iso}
                  disabled={outOfRange}
                  onClick={() => {
                    onChange(c.iso)
                    setOpen(false)
                  }}
                  className={`rounded py-1 text-xs ${
                    selected
                      ? 'bg-zinc-900 text-white'
                      : outOfRange
                        ? 'cursor-not-allowed text-zinc-300'
                        : c.inMonth
                          ? 'text-zinc-900 hover:bg-zinc-100'
                          : 'text-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  {c.day}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex justify-between border-t border-zinc-100 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(todayStr())
                setOpen(false)
              }}
              className="text-xs text-zinc-500 underline hover:text-zinc-700"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="text-xs text-zinc-500 underline hover:text-zinc-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
