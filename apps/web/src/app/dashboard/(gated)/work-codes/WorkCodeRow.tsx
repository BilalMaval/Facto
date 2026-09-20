'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  checkWorkCodeAvailable,
  deleteWorkCode,
  duplicateWorkCode,
  toggleWorkCodeActive,
  updateWorkCode,
  type FormState,
} from './actions'
import { ConfirmButton } from '../slips/ConfirmButton'
import { CodeAvailabilityHint, type CodeStatus } from './CodeAvailabilityHint'

type WorkCode = {
  id: string
  code: string
  description: string
  rate: number
  is_active: boolean
}

const initialState: FormState = null

export function WorkCodeRow({ workCode, organizationId }: { workCode: WorkCode; organizationId: string }) {
  const t = useTranslations('workCodes')
  const tc = useTranslations('common')
  const [state, formAction, pending] = useActionState(updateWorkCode, initialState)

  const [code, setCode] = useState(workCode.code)
  const [description, setDescription] = useState(workCode.description)
  const [rate, setRate] = useState(String(workCode.rate))
  const [touched, setTouched] = useState<{ code?: boolean; description?: boolean; rate?: boolean }>({})
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle')
  const [, startChecking] = useTransition()

  function handleCodeChange(value: string) {
    setCode(value)
    setCodeStatus(value.trim() && value.trim() !== workCode.code ? 'checking' : 'idle')
  }

  useEffect(() => {
    const trimmed = code.trim()
    if (!trimmed || trimmed === workCode.code) return
    const timeout = setTimeout(() => {
      startChecking(async () => {
        const { available } = await checkWorkCodeAvailable(organizationId, trimmed, workCode.id)
        setCodeStatus(available ? 'available' : 'taken')
      })
    }, 400)
    return () => clearTimeout(timeout)
  }, [code, organizationId, workCode.id, workCode.code])

  return (
    <div className="flex flex-wrap items-end gap-3 py-4">
      <form action={formAction} className="flex flex-1 flex-wrap items-end gap-3 min-w-[280px]">
        <input type="hidden" name="id" value={workCode.id} />

        {state?.error && (
          <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <div className="w-28">
          <label htmlFor={`code-${workCode.id}`} className="block text-xs font-medium text-zinc-500">
            {t('form.codeLabel')}
          </label>
          <input
            id={`code-${workCode.id}`}
            name="code"
            type="text"
            required
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, code: true }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          {touched.code && !code.trim() && <p className="mt-1 text-xs text-red-600">{t('form.codeRequired')}</p>}
          <CodeAvailabilityHint status={codeStatus} />
        </div>

        <div className="flex-1 min-w-[180px]">
          <label htmlFor={`description-${workCode.id}`} className="block text-xs font-medium text-zinc-500">
            {t('form.descriptionLabel')}
          </label>
          <input
            id={`description-${workCode.id}`}
            name="description"
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, description: true }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          {touched.description && !description.trim() && (
            <p className="mt-1 text-xs text-red-600">{t('form.descriptionRequired')}</p>
          )}
        </div>
        <div className="w-32">
          <label htmlFor={`rate-${workCode.id}`} className="block text-xs font-medium text-zinc-500">
            {t('form.rateLabel')}
          </label>
          <input
            id={`rate-${workCode.id}`}
            name="rate"
            type="number"
            step="0.01"
            min="0"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, rate: true }))}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          {touched.rate && !(parseFloat(rate) > 0) && (
            <p className="mt-1 text-xs text-red-600">{t('form.rateInvalid')}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending || codeStatus === 'taken'}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {pending ? tc('saving') : tc('save')}
        </button>
      </form>

      <form action={toggleWorkCodeActive}>
        <input type="hidden" name="id" value={workCode.id} />
        <input type="hidden" name="nextActive" value={(!workCode.is_active).toString()} />
        <button
          type="submit"
          className={`rounded-md px-3 py-2 text-sm ${
            workCode.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {workCode.is_active ? t('row.deactivate') : t('row.activate')}
        </button>
      </form>

      <form action={duplicateWorkCode}>
        <input type="hidden" name="id" value={workCode.id} />
        <button type="submit" className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
          {t('row.duplicate')}
        </button>
      </form>

      <form action={deleteWorkCode}>
        <input type="hidden" name="id" value={workCode.id} />
        <ConfirmButton
          confirmText={t('row.deleteConfirm')}
          className="rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          {t('row.delete')}
        </ConfirmButton>
      </form>
    </div>
  )
}
