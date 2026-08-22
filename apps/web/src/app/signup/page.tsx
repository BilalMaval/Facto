import Link from 'next/link'
import { SignupForm } from './SignupForm'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>
}) {
  const { next, email } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {next?.startsWith('/invite/')
              ? "You've been invited to join a team — create an account to accept."
              : "Sets up your factory's organization once confirmed."}
          </p>
        </div>

        <SignupForm next={next ?? ''} prefillEmail={email} />

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-zinc-900 underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
