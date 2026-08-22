'use client'

import { useState } from 'react'

type WorkCode = { id: string; code: string; description: string; rate: number }

function workCodeLabel(wc: WorkCode) {
  return `${wc.code} — ${wc.description} (@${Number(wc.rate).toFixed(2)})`
}

export function WorkCodeSearchSelect({
  id,
  workCodes,
  value,
  onChange,
  placeholder = 'Search a work code…',
}: {
  id?: string
  workCodes: WorkCode[]
  value: string
  onChange: (workCodeId: string) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = workCodes.find((wc) => wc.id === value)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? workCodes.filter(
        (wc) => wc.code.toLowerCase().includes(q) || wc.description.toLowerCase().includes(q)
      )
    : workCodes

  const displayValue = open ? query : selected ? workCodeLabel(selected) : query

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
        }}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-200 bg-white text-sm shadow-lg">
          {filtered.map((wc) => (
            <li
              key={wc.id}
              onMouseDown={() => {
                onChange(wc.id)
                setQuery('')
                setOpen(false)
              }}
              className="cursor-pointer px-3 py-2 hover:bg-zinc-50"
            >
              {workCodeLabel(wc)}
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-2 text-zinc-400">No matches</li>}
        </ul>
      )}
    </div>
  )
}
