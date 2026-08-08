'use client'

import { useActionState, useState } from 'react'
import { login, type FormState } from './actions'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const initialState: FormState = null

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, initialState)

  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({})
  const [password, setPassword] = useState('')

  const emailEmpty = touched.email && !email.trim()
  const emailInvalid = touched.email && email.trim() !== '' && !EMAIL_PATTERN.test(email.trim())
  const passwordEmpty = touched.password && !password

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {emailEmpty && <p className="mt-1 text-xs text-red-600">Email is required</p>}
        {emailInvalid && <p className="mt-1 text-xs text-red-600">Enter a valid email address</p>}
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        {passwordEmpty && <p className="mt-1 text-xs text-red-600">Password is required</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  )
}
