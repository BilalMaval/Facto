import Link from 'next/link'
import { LoginForm } from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
          <p className="mt-1 text-sm text-zinc-500">Welcome back to your factory dashboard.</p>
        </div>

        <LoginForm next={next ?? '/dashboard'} />

        <p className="text-center text-sm text-zinc-500">
          No account yet?{' '}
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-zinc-900 underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
