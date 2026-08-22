'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { checkInviteEmailAvailable, inviteMember, type FormState } from './actions'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type EmailStatus = 'idle' | 'checking' | 'available' | 'pending-exists'

const initialState: FormState = null

export function InviteForm({ organizationId }: { organizationId: string }) {
  const [state, formAction, pending] = useActionState(inviteMember, initialState)

  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle')
  const [, startChecking] = useTransition()

  const [formGeneration, setFormGeneration] = useState(0)
  const [lastHandledState, setLastHandledState] = useState<FormState>(null)
  if (state !== lastHandledState) {
    setLastHandledState(state)
    if (state?.success) {
      setEmail('')
      setTouched(false)
      setEmailStatus('idle')
      setFormGeneration((g) => g + 1)
    }
  }

  function handleEmailChange(value: string) {
    setEmail(value)
    setEmailStatus(EMAIL_PATTERN.test(value.trim()) ? 'checking' : 'idle')
  }

  useEffect(() => {
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) return
    const timeout = setTimeout(() => {
      startChecking(async () => {
        const { available } = await checkInviteEmailAvailable(organizationId, trimmed)
        setEmailStatus(available ? 'available' : 'pending-exists')
      })
    }, 400)
    return () => clearTimeout(timeout)
  }, [email, organizationId])

  const emailFormatInvalid = touched && email.trim() !== '' && !EMAIL_PATTERN.test(email.trim())
  const emailEmpty = touched && !email.trim()

  return (
    <form key={formGeneration} action={formAction} className="mt-6 flex flex-wrap items-end gap-3">
      <input type="hidden" name="organizationId" value={organizationId} />

      {state?.error && (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex-1 min-w-[200px]">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          onBlur={() => setTouched(true)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {emailEmpty && <p className="mt-1 text-xs text-red-600">Email is required</p>}
        {emailFormatInvalid && <p className="mt-1 text-xs text-red-600">Enter a valid email address</p>}
        {emailStatus === 'checking' && <p className="mt-1 text-xs text-zinc-400">Checking…</p>}
        {emailStatus === 'available' && <p className="mt-1 text-xs text-emerald-600">Ready to invite</p>}
        {emailStatus === 'pending-exists' && (
          <p className="mt-1 text-xs text-red-600">This email already has a pending invitation</p>
        )}
      </div>
      <div>
        <label htmlFor="role" className="block text-sm font-medium">
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue="staff"
          className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending || emailStatus === 'pending-exists'}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send invite'}
      </button>
    </form>
  )
}
