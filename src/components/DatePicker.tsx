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

// Always applied, with any caller `className` appended on top (additive, not
// a replacement) — so every picker gets the same focus/open highlight other
// text inputs and selects get natively, which a plain <button> doesn't get
// on mouse click by default (browsers only show :focus-visible for buttons
// on keyboard focus, unlike <input>/<select>). `appearance-none` resets the
// native OS button chrome, which is otherwise a source of subtle rendering
// differences. Deliberately no `transition-*` on box-shadow here: animating
// from `none` to the ring's var()-based multi-layer box-shadow left it
// permanently stuck fully transparent in testing (every underlying
// `--tw-ring-*` custom property still resolved correctly on inspection —
// only the rendered box-shadow itself broke), so the ring appears instantly
// instead.
const BASE_BUTTON_CLASSES =
  'flex w-full items-center justify-between gap-2 appearance-none rounded-md border border-zinc-300 px-3 py-2 text-left text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500'

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
// text/table displays.
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
  const seed = parseISO(value || todayStr())
  const [viewYear, setViewYear] = useState(seed.year)
  const [viewMonth, setViewMonth] = useState(seed.month)
  const containerRef = useRef<HTMLDivElement>(null)

  function toggleOpen() {
    if (!open) {
      const seedOnOpen = parseISO(value || todayStr())
      setViewYear(seedOnOpen.year)
      setViewMonth(seedOnOpen.month)
    }
    setOpen((o) => !o)
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

  const currentYear = new Date().getUTCFullYear()
  const yearOptions = Array.from({ length: 111 }, (_, i) => currentYear + 10 - i)
  const cells = buildGrid(viewYear, viewMonth)

  return (
    <div ref={containerRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={toggleOpen}
        className={`${BASE_BUTTON_CLASSES} ${open ? 'ring-1 ring-zinc-900' : ''} ${className ?? ''}`}
      >
        <span className={value ? '' : 'text-zinc-400'}>{value ? formatDate(value, dateFormat) : placeholder}</span>
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-zinc-400">
          <rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 8h14M6.5 3v3M13.5 3v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

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
