'use client'

import { useActionState } from 'react'
import { updatePlatformSettings, type FormState } from './actions'

const initialState: FormState = null

type Settings = {
  easypaisa_number: string | null
  easypaisa_title: string | null
  easypaisa_note: string | null
  jazzcash_number: string | null
  jazzcash_title: string | null
  jazzcash_note: string | null
  bank_name: string | null
  bank_account_title: string | null
  bank_account_number: string | null
  bank_iban: string | null
  bank_note: string | null
  support_email: string | null
  plan_price: number
  plan_features: string[]
  multi_business_price: number
}

export function PlatformSettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(updatePlatformSettings, initialState)

  return (
    <form action={formAction} className="max-w-xl space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>
      )}

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Plan</h2>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="planPrice" className="block text-sm font-medium">
              Basic price (Rs./month)
            </label>
            <input
              id="planPrice"
              name="planPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={settings.plan_price}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="multiBusinessPrice" className="block text-sm font-medium">
              Premium price (Rs./month)
            </label>
            <input
              id="multiBusinessPrice"
              name="multiBusinessPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={settings.multi_business_price}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-400">Charged when a business owner upgrades to add more businesses.</p>
          </div>
        </div>
        <div className="mt-3">
          <label htmlFor="planFeatures" className="block text-sm font-medium">
            Feature bullets (one per line)
          </label>
          <textarea
            id="planFeatures"
            name="planFeatures"
            rows={4}
            defaultValue={settings.plan_features.join('\n')}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Payment instructions</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Leave a method blank to hide it from the business-owner payment form.
        </p>
        <div className="mt-2 space-y-4">
          <fieldset className="rounded-md border border-zinc-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Easypaisa
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="easypaisaTitle" className="block text-sm font-medium">
                  Account title
                </label>
                <input
                  id="easypaisaTitle"
                  name="easypaisaTitle"
                  type="text"
                  defaultValue={settings.easypaisa_title ?? ''}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="easypaisaNumber" className="block text-sm font-medium">
                  Number
                </label>
                <input
                  id="easypaisaNumber"
                  name="easypaisaNumber"
                  type="text"
                  defaultValue={settings.easypaisa_number ?? ''}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor="easypaisaNote" className="block text-sm font-medium">
                Instructions shown to customers
              </label>
              <textarea
                id="easypaisaNote"
                name="easypaisaNote"
                rows={2}
                placeholder="e.g. Send as 'Send Money', not 'Mobile Load'"
                defaultValue={settings.easypaisa_note ?? ''}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-zinc-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              JazzCash
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="jazzcashTitle" className="block text-sm font-medium">
                  Account title
                </label>
                <input
                  id="jazzcashTitle"
                  name="jazzcashTitle"
                  type="text"
                  defaultValue={settings.jazzcash_title ?? ''}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="jazzcashNumber" className="block text-sm font-medium">
                  Number
                </label>
                <input
                  id="jazzcashNumber"
                  name="jazzcashNumber"
                  type="text"
                  defaultValue={settings.jazzcash_number ?? ''}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor="jazzcashNote" className="block text-sm font-medium">
                Instructions shown to customers
              </label>
              <textarea
                id="jazzcashNote"
                name="jazzcashNote"
                rows={2}
                defaultValue={settings.jazzcash_note ?? ''}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-zinc-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Bank transfer
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bankName" className="block text-sm font-medium">
                  Bank name
                </label>
                <input
                  id="bankName"
                  name="bankName"
                  type="text"
                  defaultValue={settings.bank_name ?? ''}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bankAccountTitle" className="block text-sm font-medium">
                  Account title
                </label>
                <input
                  id="bankAccountTitle"
                  name="bankAccountTitle"
                  type="text"
                  defaultValue={settings.bank_account_title ?? ''}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bankAccountNumber" className="block text-sm font-medium">
                  Account number
                </label>
                <input
                  id="bankAccountNumber"
                  name="bankAccountNumber"
                  type="text"
                  defaultValue={settings.bank_account_number ?? ''}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="bankIban" className="block text-sm font-medium">
                  IBAN
                </label>
                <input
                  id="bankIban"
                  name="bankIban"
                  type="text"
                  defaultValue={settings.bank_iban ?? ''}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor="bankNote" className="block text-sm font-medium">
                Instructions shown to customers
              </label>
              <textarea
                id="bankNote"
                name="bankNote"
                rows={2}
                defaultValue={settings.bank_note ?? ''}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </fieldset>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Support</h2>
        <div className="mt-2">
          <label htmlFor="supportEmail" className="block text-sm font-medium">
            Support email
          </label>
          <input
            id="supportEmail"
            name="supportEmail"
            type="email"
            defaultValue={settings.support_email ?? ''}
            placeholder="Shown to suspended accounts for reactivation help"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}
