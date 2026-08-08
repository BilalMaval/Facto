'use client'

import { useRouter } from 'next/navigation'
import { WorkerSearchSelect } from '../_components/WorkerSearchSelect'

type Worker = { id: string; worker_code: string; name: string; is_active: boolean }

export function DashboardWorkerSelector({
  workers,
  workerId,
}: {
  workers: Worker[]
  workerId?: string
}) {
  const router = useRouter()

  return (
    <WorkerSearchSelect
      id="dashboard-worker-select"
      workers={workers}
      value={workerId ?? ''}
      onChange={(id) => router.push(id ? `/dashboard?workerId=${id}` : '/dashboard')}
      placeholder="Search a worker to start logging…"
      allowAll={false}
    />
  )
}
