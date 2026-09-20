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

const ICON_BTN = 'inline-flex h-9 w-9 items-center justify-center rounded-md'
const SVG_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

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
    <div className="flex flex-wrap items-end gap-2 py-4 sm:flex-nowrap">
      <form action={formAction} className="flex min-w-[280px] flex-1 flex-wrap items-end gap-2 sm:flex-nowrap">
        <input type="hidden" name="id" value={workCode.id} />

        {state?.error && (
          <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}

        <div className="w-24 shrink-0">
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
        <div className="w-28 shrink-0">
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

      <div className="flex items-center gap-0.5">
        <form action={toggleWorkCodeActive}>
          <input type="hidden" name="id" value={workCode.id} />
          <input type="hidden" name="nextActive" value={(!workCode.is_active).toString()} />
          <button
            type="submit"
            title={workCode.is_active ? t('row.deactivate') : t('row.activate')}
            aria-label={workCode.is_active ? t('row.deactivate') : t('row.activate')}
            className={`${ICON_BTN} ${
              workCode.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {workCode.is_active ? (
              <svg {...SVG_PROPS}>
                <circle cx="12" cy="12" r="9" />
                <path d="M5.6 5.6l12.8 12.8" />
              </svg>
            ) : (
              <svg {...SVG_PROPS}>
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12.5l3 3 5-6" />
              </svg>
            )}
          </button>
        </form>

        <form action={duplicateWorkCode}>
          <input type="hidden" name="id" value={workCode.id} />
          <button
            type="submit"
            title={t('row.duplicate')}
            aria-label={t('row.duplicate')}
            className={`${ICON_BTN} text-zinc-600 hover:bg-zinc-100`}
          >
            <svg {...SVG_PROPS}>
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a2 2 0 012-2h9" />
            </svg>
          </button>
        </form>

        <form action={deleteWorkCode}>
          <input type="hidden" name="id" value={workCode.id} />
          <ConfirmButton
            confirmText={t('row.deleteConfirm')}
            title={t('row.delete')}
            className={`${ICON_BTN} text-red-600 hover:bg-red-50`}
          >
            <svg {...SVG_PROPS}>
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
            </svg>
          </ConfirmButton>
        </form>
      </div>
    </div>
  )
}
