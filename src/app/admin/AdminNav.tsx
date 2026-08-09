'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/dashboard/actions'

const TABS = [
  { href: '/admin', label: 'Organizations' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/support', label: 'Support', key: 'support' },
  { href: '/admin/settings', label: 'Settings' },
]

export function AdminNav({
  userEmail,
  supportBadgeCount = 0,
}: {
  userEmail: string
  supportBadgeCount?: number
}) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-900 text-white print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">Platform Admin</span>
          <p className="text-xs text-zinc-400">{userEmail}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Sign out
          </button>
        </form>
      </div>

      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pt-3">
        {TABS.map((tab) => {
          const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href)
          const badgeCount = tab.key === 'support' ? supportBadgeCount : 0
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              {tab.label}
              {badgeCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
