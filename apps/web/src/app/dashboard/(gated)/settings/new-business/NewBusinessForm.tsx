'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { createAdditionalBusiness, type FormState } from './actions'

const initialState: FormState = null

export function NewBusinessForm() {
  const t = useTranslations('newBusiness')
  const [state, formAction, pending] = useActionState(createAdditionalBusiness, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          {t('nameLabel')}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder={t('namePlaceholder')}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? t('creating') : t('createBusiness')}
      </button>
    </form>
  )
}
