'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { calculateAge } from '@/lib/age'
import { formatCnic } from '@/lib/cnic'
import { compressImage } from '@/lib/compressImage'
import { formatMoney } from '@/lib/format'
import {
  checkCnicAvailable,
  toggleWorkerActive,
  updateWorker,
  updateWorkerPaymentType,
  uploadWorkerPhoto,
  type FormState,
} from './actions'
import { Field } from './Field'
import { CodeAvailabilityHint, type CodeStatus } from './CodeAvailabilityHint'
import { DatePicker } from '@/components/DatePicker'
import { today as todayStr, type DateFormat } from '@/lib/dates'

export type EmploymentType = 'contract' | 'salary' | 'hybrid'

type Worker = {
  id: string
  worker_code: string | null
  name: string
  father_name: string | null
  contact_no: string | null
  designation: string | null
  address: string | null
  cnic: string | null
  date_of_birth: string | null
  advance_balance: number
  is_active: boolean
  employment_type: EmploymentType
  weekly_salary: number | null
}

const initialState: FormState = null

export function WorkerRow({
  worker,
  organizationId,
  photoUrl,
  currency,
  showDecimals,
  viewerRole,
  dateFormat,
}: {
  worker: Worker
  organizationId: string
  photoUrl?: string
  currency: string
  showDecimals: boolean
  viewerRole: string
  dateFormat: DateFormat
}) {
  const isOwner = viewerRole === 'owner'
  const [state, formAction, pending] = useActionState(updateWorker, initialState)
  const [paymentTypeState, paymentTypeFormAction, paymentTypePending] = useActionState(
    updateWorkerPaymentType,
    initialState
  )

  const [workerCode, setWorkerCode] = useState(worker.worker_code ?? '')
  const [name, setName] = useState(worker.name)
  const [cnic, setCnic] = useState(formatCnic(worker.cnic ?? ''))
  const [dateOfBirth, setDateOfBirth] = useState(worker.date_of_birth ?? '')
  const [employmentType, setEmploymentType] = useState<EmploymentType>(worker.employment_type)
  const [cnicStatus, setCnicStatus] = useState<CodeStatus>('idle')
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

  function handleCnicChange(value: string) {
    const formatted = formatCnic(value)
    setCnic(formatted)
    const digits = formatted.replace(/\D/g, '')
    setCnicStatus(digits && digits !== (worker.cnic ?? '') ? 'checking' : 'idle')
  }

  useEffect(() => {
    if (!isOwner) return
    const digits = cnic.replace(/\D/g, '')
    if (digits.length !== 13 || digits === (worker.cnic ?? '')) return
    const timeout = setTimeout(() => {
      startChecking(async () => {
        const { available } = await checkCnicAvailable(organizationId, digits, worker.id)
        setCnicStatus(available ? 'available' : 'taken')
      })
    }, 400)
    return () => clearTimeout(timeout)
  }, [cnic, organizationId, worker.id, worker.cnic, isOwner])

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

      <div className="flex-1 space-y-4">
        <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={worker.id} />

          {!isOwner && (
            <p className="sm:col-span-2 text-xs text-zinc-400">
              Only the business owner can edit a worker&apos;s profile.
            </p>
          )}

          {state?.error && (
            <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <div>
            <label htmlFor={`${worker.id}-workerCode`} className="block text-xs font-medium text-zinc-500">
              Worker ID <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              id={`${worker.id}-workerCode`}
              name="workerCode"
              type="text"
              disabled={!isOwner}
              value={workerCode}
              onChange={(e) => setWorkerCode(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
            />
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
              disabled={!isOwner}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
            />
          </div>

          <Field
            idPrefix={worker.id}
            label="Father's name"
            name="fatherName"
            defaultValue={worker.father_name ?? ''}
            disabled={!isOwner}
          />

          <div>
            <label htmlFor={`${worker.id}-cnic`} className="block text-xs font-medium text-zinc-500">
              CNIC
            </label>
            <input
              id={`${worker.id}-cnic`}
              name="cnic"
              type="text"
              required
              disabled={!isOwner}
              inputMode="numeric"
              placeholder="34101-1234567-1"
              maxLength={15}
              value={cnic}
              onChange={(e) => handleCnicChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
            />
            {isOwner && <CodeAvailabilityHint status={cnicStatus} label="CNIC" />}
          </div>

          <Field
            idPrefix={worker.id}
            label="Contact no."
            name="contactNo"
            defaultValue={worker.contact_no ?? ''}
            disabled={!isOwner}
          />
          <Field
            idPrefix={worker.id}
            label="Designation"
            name="designation"
            defaultValue={worker.designation ?? ''}
            disabled={!isOwner}
          />
          <Field
            idPrefix={worker.id}
            label="Address"
            name="address"
            defaultValue={worker.address ?? ''}
            disabled={!isOwner}
          />

          <div>
            <label htmlFor={`${worker.id}-dateOfBirth`} className="block text-xs font-medium text-zinc-500">
              Date of birth
            </label>
            <DatePicker
              id={`${worker.id}-dateOfBirth`}
              name="dateOfBirth"
              disabled={!isOwner}
              value={dateOfBirth}
              onChange={setDateOfBirth}
              dateFormat={dateFormat}
              max={todayStr()}
              className="mt-1"
            />
            {age !== null && <p className="mt-1 text-xs text-zinc-500">Age: {age}</p>}
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              Advance balance:{' '}
              <span className="font-medium text-zinc-900">
                {formatMoney(worker.advance_balance, currency, showDecimals)}
              </span>
            </p>
            {isOwner && (
              <button
                type="submit"
                disabled={pending || cnicStatus === 'taken'}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </form>

        <form
          action={paymentTypeFormAction}
          className="flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-3"
        >
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="workerId" value={worker.id} />

          {paymentTypeState?.error && (
            <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{paymentTypeState.error}</p>
          )}

          <div>
            <label htmlFor={`${worker.id}-employmentType`} className="block text-xs font-medium text-zinc-500">
              Payment type
            </label>
            <select
              id={`${worker.id}-employmentType`}
              name="employmentType"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="contract">Contract — paid per work logged</option>
              <option value="salary">Salary — fixed weekly amount</option>
              <option value="hybrid">Hybrid — work logged + weekly salary</option>
            </select>
          </div>

          {employmentType !== 'contract' && (
            <div>
              <label htmlFor={`${worker.id}-weeklySalary`} className="block text-xs font-medium text-zinc-500">
                Weekly Salary
              </label>
              <input
                id={`${worker.id}-weeklySalary`}
                name="weeklySalary"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={worker.weekly_salary ?? ''}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={paymentTypePending}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {paymentTypePending ? 'Saving…' : 'Save payment type'}
          </button>
        </form>
      </div>

      <form action={toggleWorkerActive} className="flex items-start">
        <input type="hidden" name="organizationId" value={organizationId} />
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
