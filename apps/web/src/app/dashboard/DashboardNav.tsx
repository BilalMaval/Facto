'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WEEK_SCHEME_LABEL, type WeekStartDay } from '@/lib/dates'
import { signOut } from './actions'
import { OrgSwitcher } from './OrgSwitcher'

type Tab = { href: string; label: string; key?: string; adminOnly?: boolean; ownerOnly?: boolean }

const MAIN_TABS: Tab[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/entries', label: 'Daily entry' },
  { href: '/dashboard/slips', label: 'Weekly slips' },
  { href: '/dashboard/work-codes', label: 'Work codes', adminOnly: true },
  { href: '/dashboard/workers', label: 'Workers', adminOnly: true },
  { href: '/dashboard/team', label: 'Team' },
]

const ACCOUNT_TABS: Tab[] = [
  { href: '/dashboard/billing', label: 'Billing', key: 'billing', ownerOnly: true },
  { href: '/dashboard/support', label: 'Support', key: 'support', ownerOnly: true },
  { href: '/dashboard/settings', label: 'Settings', key: 'settings', ownerOnly: true },
]

type Membership = { organizationId: string; orgName: string; role: string }

export function DashboardNav({
  orgName,
  role,
  userEmail,
  hiddenTabs,
  memberships,
  activeOrgId,
  supportBadgeCount = 0,
  weekStartDay,
}: {
  orgName: string
  role: string
  userEmail: string
  hiddenTabs: string[]
  memberships: Membership[]
  activeOrgId: string
  supportBadgeCount?: number
  weekStartDay: WeekStartDay
}) {
  const pathname = usePathname()
  const isAdmin = role === 'owner' || role === 'admin'
  const isOwner = role === 'owner'
  const visible = (t: Tab) =>
    (!t.adminOnly || isAdmin) && (!t.ownerOnly || isOwner) && !(t.key && hiddenTabs.includes(t.key))
  const mainTabs = MAIN_TABS.filter(visible)
  const accountTabs = ACCOUNT_TABS.filter(visible)

  function renderTab(tab: Tab) {
    const active = tab.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(tab.href)
    const badgeCount = tab.key === 'support' ? supportBadgeCount : 0
    return (
      <Link
        key={tab.href}
        href={tab.href}
        className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? 'border-zinc-900 text-zinc-900'
            : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800'
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
  }

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {memberships.length > 1 ? (
              <OrgSwitcher memberships={memberships} activeOrgId={activeOrgId} />
            ) : (
              <p className="text-sm font-semibold text-zinc-900">{orgName}</p>
            )}
            {/* The org's CURRENT weekly pay period — always this org's live
                setting, unlike a specific slip's own (Mon-Sat)/(Sat-Thu)
                label (SlipView.tsx), which reflects whatever scheme was
                active when THAT week was computed and can still show the
                org's past scheme long after it's been changed. */}
            <span
              title="Current weekly pay period"
              className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
            >
              {WEEK_SCHEME_LABEL[weekStartDay]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {userEmail} · {role}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Sign out
          </button>
        </form>
      </div>

      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-1 overflow-x-auto px-4 pt-3">
        <div className="flex gap-1">{mainTabs.map(renderTab)}</div>
        <div className="flex gap-1">{accountTabs.map(renderTab)}</div>
      </nav>
    </header>
  )
}
