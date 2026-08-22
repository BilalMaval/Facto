'use client'

import { useState } from 'react'
import { workerLabel } from '@/lib/format'

type Worker = { id: string; worker_code: string | null; name: string; is_active: boolean }

export function WorkerSearchSelect({
  id,
  workers,
  value,
  onChange,
  placeholder = 'Search worker by name or ID…',
  allowAll = true,
}: {
  id?: string
  workers: Worker[]
  value: string
  onChange: (workerId: string) => void
  placeholder?: string
  allowAll?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = workers.find((w) => w.id === value)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? workers.filter(
        (w) => w.name.toLowerCase().includes(q) || (w.worker_code ?? '').toLowerCase().includes(q)
      )
    : workers

  const displayValue = open ? query : selected ? workerLabel(selected) : query

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('')
        }}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-200 bg-white text-sm shadow-lg">
          {allowAll && (
            <li
              onMouseDown={() => {
                onChange('')
                setQuery('')
                setOpen(false)
              }}
              className="cursor-pointer px-3 py-2 text-zinc-500 hover:bg-zinc-50"
            >
              All workers
            </li>
          )}
          {filtered.map((w) => (
            <li
              key={w.id}
              onMouseDown={() => {
                onChange(w.id)
                setQuery('')
                setOpen(false)
              }}
              className="cursor-pointer px-3 py-2 hover:bg-zinc-50"
            >
              {workerLabel(w)}
              {!w.is_active && <span className="text-zinc-400"> (inactive)</span>}
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-2 text-zinc-400">No matches</li>}
        </ul>
      )}
    </div>
  )
}
