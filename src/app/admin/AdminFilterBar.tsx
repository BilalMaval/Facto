'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

export function AdminFilterBar({
  basePath,
  q,
  searchPlaceholder,
  selects,
  dateRange,
}: {
  basePath: string
  q: string
  searchPlaceholder: string
  selects: SelectFilter[]
  dateRange?: DateRange
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [text, setText] = useState(q)
  const [lastQ, setLastQ] = useState(q)
  if (q !== lastQ) {
    setLastQ(q)
    setText(q)
  }

  function go(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.push(`${basePath}?${params.toString()}`)
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (text !== q) go({ q: text })
    }, 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="admin-search" className="block text-sm font-medium">
          Search
        </label>
        <input
          id="admin-search"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={searchPlaceholder}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
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
            <input
              id="admin-filter-from"
              type="date"
              value={dateRange.fromValue}
              onChange={(e) => go({ [dateRange.fromParam]: e.target.value })}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="w-36">
            <label htmlFor="admin-filter-to" className="block text-sm font-medium">
              To
            </label>
            <input
              id="admin-filter-to"
              type="date"
              value={dateRange.toValue}
              onChange={(e) => go({ [dateRange.toParam]: e.target.value })}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
