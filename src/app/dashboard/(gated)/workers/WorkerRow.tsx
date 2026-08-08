'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { calculateAge } from '@/lib/age'
import { formatCnic } from '@/lib/cnic'
import { compressImage } from '@/lib/compressImage'
import {
  checkWorkerCodeAvailable,
  toggleWorkerActive,
  updateWorker,
  uploadWorkerPhoto,
  type FormState,
} from './actions'
import { Field } from './Field'
import { CodeAvailabilityHint, type CodeStatus } from './CodeAvailabilityHint'

type Worker = {
  id: string
  worker_code: string
  name: string
  father_name: string | null
  contact_no: string | null
  designation: string | null
  address: string | null
  cnic: string | null
  date_of_birth: string | null
  advance_balance: number
  is_active: boolean
}

const initialState: FormState = null

export function WorkerRow({
  worker,
  organizationId,
  photoUrl,
}: {
  worker: Worker
  organizationId: string
  photoUrl?: string
}) {
  const [state, formAction, pending] = useActionState(updateWorker, initialState)

  const [workerCode, setWorkerCode] = useState(worker.worker_code)
  const [name, setName] = useState(worker.name)
  const [cnic, setCnic] = useState(formatCnic(worker.cnic ?? ''))
  const [dateOfBirth, setDateOfBirth] = useState(worker.date_of_birth ?? '')
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle')
  const [, startChecking] = useTransition()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [compressingPhoto, setCompressingPhoto] = useState(false)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCompressingPhoto(true)
    const compressed = await compressImage(file, { maxDimension: 800, quality: 0.8 })
    setCompressingPhoto(false)

    const input = photoInputRef.current
    if (input) {
      const dt = new DataTransfer()
      dt.items.add(compressed)
      input.files = dt.files
    }
  }

  function handleWorkerCodeChange(value: string) {
    setWorkerCode(value)
    const code = value.trim()
    setCodeStatus(code && code !== worker.worker_code ? 'checking' : 'idle')
  }

  useEffect(() => {
    const code = workerCode.trim()
    if (!code || code === worker.worker_code) return
    const timeout = setTimeout(() => {
      startChecking(async () => {
        const { available } = await checkWorkerCodeAvailable(organizationId, code, worker.id)
        setCodeStatus(available ? 'available' : 'taken')
      })
    }, 400)
    return () => clearTimeout(timeout)
  }, [workerCode, organizationId, worker.id, worker.worker_code])

  const age = calculateAge(dateOfBirth)

  return (
    <div className="flex flex-wrap gap-4 py-6">
      <div className="flex flex-col items-center gap-2">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={worker.name} className="h-20 w-20 rounded-md object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-400">
            No photo
          </div>
        )}
        <form action={uploadWorkerPhoto} className="flex flex-col items-center gap-1">
          <input type="hidden" name="id" value={worker.id} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input
            ref={photoInputRef}
            type="file"
            name="photo"
            accept="image/*"
            onChange={handlePhotoChange}
            className="w-24 text-xs"
          />
          <button
            type="submit"
            disabled={compressingPhoto}
            className="text-xs text-zinc-600 underline hover:text-zinc-900 disabled:opacity-50"
          >
            {compressingPhoto ? 'Compressing…' : 'Upload'}
          </button>
        </form>
      </div>

      <form action={formAction} className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={worker.id} />

        {state?.error && (
          <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <div>
          <label htmlFor={`${worker.id}-workerCode`} className="block text-xs font-medium text-zinc-500">
            Worker ID
          </label>
          <input
            id={`${worker.id}-workerCode`}
            name="workerCode"
            type="text"
            required
            value={workerCode}
            onChange={(e) => handleWorkerCodeChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <CodeAvailabilityHint status={codeStatus} />
        </div>

        <div>
          <label htmlFor={`${worker.id}-name`} className="block text-xs font-medium text-zinc-500">
            Name
          </label>
          <input
            id={`${worker.id}-name`}
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <Field idPrefix={worker.id} label="Father's name" name="fatherName" defaultValue={worker.father_name ?? ''} />
        <Field idPrefix={worker.id} label="Contact no." name="contactNo" defaultValue={worker.contact_no ?? ''} />
        <Field idPrefix={worker.id} label="Designation" name="designation" defaultValue={worker.designation ?? ''} />
        <Field idPrefix={worker.id} label="Address" name="address" defaultValue={worker.address ?? ''} />

        <div>
          <label htmlFor={`${worker.id}-cnic`} className="block text-xs font-medium text-zinc-500">
            CNIC
          </label>
          <input
            id={`${worker.id}-cnic`}
            name="cnic"
            type="text"
            inputMode="numeric"
            placeholder="34101-1234567-1"
            maxLength={15}
            value={cnic}
            onChange={(e) => setCnic(formatCnic(e.target.value))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor={`${worker.id}-dateOfBirth`} className="block text-xs font-medium text-zinc-500">
            Date of birth
          </label>
          <input
            id={`${worker.id}-dateOfBirth`}
            name="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          {age !== null && <p className="mt-1 text-xs text-zinc-500">Age: {age}</p>}
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            Advance balance:{' '}
            <span className="font-medium text-zinc-900">{Number(worker.advance_balance).toFixed(2)}</span>
          </p>
          <button
            type="submit"
            disabled={pending || codeStatus === 'taken'}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <form action={toggleWorkerActive} className="flex items-start">
        <input type="hidden" name="id" value={worker.id} />
        <input type="hidden" name="nextActive" value={(!worker.is_active).toString()} />
        <button
          type="submit"
          className={`rounded-md px-3 py-2 text-sm ${
            worker.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {worker.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </form>
    </div>
  )
}
