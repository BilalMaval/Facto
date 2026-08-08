export type CodeStatus = 'idle' | 'checking' | 'available' | 'taken'

export function CodeAvailabilityHint({ status }: { status: CodeStatus }) {
  if (status === 'checking') return <p className="mt-1 text-xs text-zinc-400">Checking availability…</p>
  if (status === 'available') return <p className="mt-1 text-xs text-emerald-600">Available</p>
  if (status === 'taken') return <p className="mt-1 text-xs text-red-600">This Worker ID is already in use</p>
  return null
}
