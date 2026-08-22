'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DatePicker } from '@/components/DatePicker'

type SelectFilter = {
  name: string
  label?: string
  value: string
  options: { value: string; label: string }[]
}

type DateRange = {
  fromParam: string
  toParam: string
  fromValue: string
  toValue: string
}

type Suggestion = { value: string; label: string }

export function AdminFilterBar({
  basePath,
  q,
  searchPlaceholder,
  selects,
  dateRange,
  suggestions,
}: {
  basePath: string
  q: string
  searchPlaceholder: string
  selects: SelectFilter[]
  dateRange?: DateRange
  // Optional dropdown of every available record (not just ones matching the
  // current query) — same typeahead pattern as WorkerSearchSelect/
  // WorkCodeSearchSelect on the Dashboard and Weekly Slips tabs, so search
  // bars here can be browsed the same way instead of only free-typed.
  suggestions?: Suggestion[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [text, setText] = useState(q)
  const [lastQ, setLastQ] = useState(q)
  if (q !== lastQ) {
    setLastQ(q)
    setText(q)
  }
  const [searchOpen, setSearchOpen] = useState(false)
  const searchNeedle = text.trim().toLowerCase()
  const filteredSuggestions = suggestions
    ? searchNeedle
      ? suggestions.filter((s) => s.label.toLowerCase().includes(searchNeedle))
      : suggestions
    : []

  function go(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.push(`${basePath}?${params.toString()}`)
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      if (text !== q) go({ q: text })
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="relative min-w-[220px] flex-1">
        <label htmlFor="admin-search" className="block text-sm font-medium">
          Search
        </label>
        <input
          id="admin-search"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {suggestions && searchOpen && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-200 bg-white text-sm shadow-lg">
            {filteredSuggestions.map((s) => (
              <li
                key={s.value}
                onMouseDown={() => {
                  if (debounceRef.current) clearTimeout(debounceRef.current)
                  setText(s.value)
                  setSearchOpen(false)
                  go({ q: s.value })
                }}
                className="cursor-pointer px-3 py-2 hover:bg-zinc-50"
              >
                {s.label}
              </li>
            ))}
            {filteredSuggestions.length === 0 && <li className="px-3 py-2 text-zinc-400">No matches</li>}
          </ul>
        )}
      </div>

      {selects.map((s) => (
        <div key={s.name} className="w-44">
          <label htmlFor={`admin-filter-${s.name}`} className="block text-sm font-medium capitalize">
            {s.label ?? s.name}
          </label>
          <select
            id={`admin-filter-${s.name}`}
            value={s.value}
            onChange={(e) => go({ [s.name]: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {dateRange && (
        <div className="flex gap-3">
          <div className="w-36">
            <label htmlFor="admin-filter-from" className="block text-sm font-medium">
              From
            </label>
            <DatePicker
              id="admin-filter-from"
              value={dateRange.fromValue}
              onChange={(v) => go({ [dateRange.fromParam]: v })}
              dateFormat="YYYY-MM-DD"
              className="mt-1"
            />
          </div>
          <div className="w-36">
            <label htmlFor="admin-filter-to" className="block text-sm font-medium">
              To
            </label>
            <DatePicker
              id="admin-filter-to"
              value={dateRange.toValue}
              onChange={(v) => go({ [dateRange.toParam]: v })}
              dateFormat="YYYY-MM-DD"
              className="mt-1"
            />
          </div>
        </div>
      )}
    </div>
  )
}
