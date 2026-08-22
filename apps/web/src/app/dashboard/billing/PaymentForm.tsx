'use client'

import { useActionState, useRef, useState } from 'react'
import { submitPaymentProof, type FormState } from './actions'
import { today, type DateFormat } from '@/lib/dates'
import { compressImage } from '@/lib/compressImage'
import { DatePicker } from '@/components/DatePicker'

const initialState: FormState = null

type PlatformSettings = {
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
}

type Method = 'easypaisa' | 'jazzcash' | 'bank_transfer'

export function PaymentForm({
  organizationId,
  defaultAmount,
  settings,
  purpose = 'subscription',
  successMessage,
  dateFormat,
}: {
  organizationId: string
  defaultAmount: number
  settings: PlatformSettings
  purpose?: 'subscription' | 'plan_upgrade'
  successMessage?: string
  dateFormat: DateFormat
}) {
  const [state, formAction, pending] = useActionState(submitPaymentProof, initialState)
  const [formGeneration, setFormGeneration] = useState(0)
  const [paymentDate, setPaymentDate] = useState(today())
  const [lastHandledState, setLastHandledState] = useState<FormState>(null)
  if (state !== lastHandledState) {
    setLastHandledState(state)
    if (state?.success) setFormGeneration((g) => g + 1)
  }

  const availableMethods: { value: Method; label: string }[] = [
    settings.easypaisa_number ? { value: 'easypaisa' as const, label: 'Easypaisa' } : null,
    settings.jazzcash_number ? { value: 'jazzcash' as const, label: 'JazzCash' } : null,
    settings.bank_account_number ? { value: 'bank_transfer' as const, label: 'Bank transfer' } : null,
  ].filter((m): m is { value: Method; label: string } => m !== null)

  const [method, setMethod] = useState<Method | ''>(availableMethods[0]?.value ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [proofFileName, setProofFileName] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)

  async function handleProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setProofFileName(null)
      return
    }
    setCompressing(true)
    const compressed = await compressImage(file, { maxDimension: 1920, quality: 0.85 })
    setCompressing(false)

    const input = fileInputRef.current
    if (input) {
      const dt = new DataTransfer()
      dt.items.add(compressed)
      input.files = dt.files
    }
    setProofFileName(compressed.name)
  }

  if (state?.success) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        {successMessage ??
          "Payment submitted — we'll review it and activate your account shortly. You can track its status below."}
      </div>
    )
  }

  if (!availableMethods.length) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
        Payment methods aren&apos;t configured yet. Please check back shortly.
      </p>
    )
  }

  return (
    <form
      key={formGeneration}
      action={formAction}
      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="purpose" value={purpose} />

      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div>
        <span className="block text-sm font-medium">Payment method</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {availableMethods.map((m) => (
            <label
              key={m.value}
              className="flex cursor-pointer items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50 has-[:checked]:text-zinc-900"
            >
              <input
                type="radio"
                name="method"
                value={m.value}
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
                className="sr-only"
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      {method === 'easypaisa' && (
        <div className="space-y-1 rounded-md bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
          {settings.easypaisa_title && (
            <p>
              Account title: <span className="font-medium">{settings.easypaisa_title}</span>
            </p>
          )}
          <p>
            Easypaisa number: <span className="font-medium">{settings.easypaisa_number}</span>
          </p>
          {settings.easypaisa_note && (
            <p className="border-t border-zinc-200 pt-1.5 text-zinc-600">{settings.easypaisa_note}</p>
          )}
        </div>
      )}
      {method === 'jazzcash' && (
        <div className="space-y-1 rounded-md bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
          {settings.jazzcash_title && (
            <p>
              Account title: <span className="font-medium">{settings.jazzcash_title}</span>
            </p>
          )}
          <p>
            JazzCash number: <span className="font-medium">{settings.jazzcash_number}</span>
          </p>
          {settings.jazzcash_note && (
            <p className="border-t border-zinc-200 pt-1.5 text-zinc-600">{settings.jazzcash_note}</p>
          )}
        </div>
      )}
      {method === 'bank_transfer' && (
        <div className="space-y-1 rounded-md bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
          {settings.bank_name && (
            <p>
              Bank: <span className="font-medium">{settings.bank_name}</span>
            </p>
          )}
          {settings.bank_account_title && (
            <p>
              Account title: <span className="font-medium">{settings.bank_account_title}</span>
            </p>
          )}
          <p>
            Account number: <span className="font-medium">{settings.bank_account_number}</span>
          </p>
          {settings.bank_iban && (
            <p>
              IBAN: <span className="font-medium">{settings.bank_iban}</span>
            </p>
          )}
          {settings.bank_note && (
            <p className="border-t border-zinc-200 pt-1.5 text-zinc-600">{settings.bank_note}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium">
            Amount paid (Rs.)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaultAmount}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="paymentDate" className="block text-sm font-medium">
            Date paid
          </label>
          <DatePicker
            id="paymentDate"
            name="paymentDate"
            value={paymentDate}
            onChange={setPaymentDate}
            dateFormat={dateFormat}
            max={today()}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <label htmlFor="transactionReference" className="block text-sm font-medium">
          Transaction ID / reference
        </label>
        <input
          id="transactionReference"
          name="transactionReference"
          type="text"
          required
          placeholder="e.g. TXN123456789"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <span className="block text-sm font-medium">Payment screenshot</span>
        <input
          ref={fileInputRef}
          id="proof"
          name="proof"
          type="file"
          accept="image/*"
          required
          className="sr-only"
          onChange={handleProofChange}
        />
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Choose file
          </button>
          <span className="truncate text-sm text-zinc-500">
            {compressing ? 'Compressing…' : (proofFileName ?? 'No file chosen')}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Submitting…' : 'Submit payment'}
      </button>
    </form>
  )
}
