'use client'

import { useRouter } from 'next/navigation'
import { WorkerSearchSelect } from '../_components/WorkerSearchSelect'
import { setPreferenceCookie } from '@/lib/clientCookie'

type Worker = { id: string; worker_code: string | null; name: string; is_active: boolean }

export function DashboardWorkerSelector({
  workers,
  workerId,
}: {
  workers: Worker[]
  workerId?: string
}) {
  const router = useRouter()

  function handleChange(id: string) {
    // Remembered so the plain "Dashboard" nav link (no query params) still
    // lands back on the worker you were looking at, instead of resetting to
    // "no worker selected" every time you switch tabs and come back.
    if (id) setPreferenceCookie('dash_worker_id', id)
    router.push(id ? `/dashboard?workerId=${id}` : '/dashboard')
  }

  return (
    <WorkerSearchSelect
      id="dashboard-worker-select"
      workers={workers}
      value={workerId ?? ''}
      onChange={handleChange}
      placeholder="Search a worker to start logging…"
      allowAll={false}
    />
  )
}
