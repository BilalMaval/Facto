'use client'

import Link from 'next/link'
import { useState } from 'react'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Not started',
  trial: 'Trial',
  active: 'Active',
  grace: 'Grace',
  suspended: 'Suspended',
  trial_expired: 'Trial expired',
  cancelled: 'Cancelled',
}

export type OrgRow = {
  id: string
  name: string
  ownerEmail: string
  planLabel: string
  liveStatus: string
  monthly_fee: number | null
  memberCount: number
  workerCount: number
  created_at: string | null
  hidden_nav_tabs: string[]
  isChild: boolean
  parentOrgId: string
  childCount: number
}

export function OrganizationsTable({ rows }: { rows: OrgRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(orgId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(orgId)) next.delete(orgId)
      else next.add(orgId)
      return next
    })
  }

  const visibleRows = rows.filter((r) => !r.isChild || expanded.has(r.parentOrgId))

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
            <th className="px-4 py-3">Organization</th>
            <th className="px-4 py-3">Owner email</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Monthly fee</th>
            <th className="px-4 py-3 text-right">Members</th>
            <th className="px-4 py-3 text-right">Workers</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {!visibleRows.length && (
            <tr>
              <td colSpan={9} className="px-4 py-6 text-center text-zinc-400">
                No organizations match.
              </td>
            </tr>
          )}
          {visibleRows.map((org) => {
            const isExpanded = expanded.has(org.id)
            return (
              <tr key={org.id} className={`border-b border-zinc-100 last:border-0 ${org.isChild ? 'bg-zinc-50/60' : ''}`}>
                <td className={`px-4 py-3 ${org.isChild ? 'pl-8 text-zinc-600' : 'font-medium text-zinc-900'}`}>
                  {!org.isChild && org.childCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggle(org.id)}
                      aria-label={isExpanded ? 'Collapse child businesses' : 'Expand child businesses'}
                      className="mr-1.5 inline-flex w-4 text-zinc-400 hover:text-zinc-700"
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  )}
                  {org.isChild && <span className="mr-1.5 text-zinc-300">↳</span>}
                  {org.name}
                  {!org.isChild && org.childCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggle(org.id)}
                      className="ml-2 text-xs text-zinc-400 underline hover:text-zinc-600"
                    >
                      +{org.childCount} {org.childCount === 1 ? 'business' : 'businesses'}
                    </button>
                  )}
                  {org.hidden_nav_tabs.length > 0 && (
                    <span className="ml-2 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {org.hidden_nav_tabs.length} tab{org.hidden_nav_tabs.length === 1 ? '' : 's'} hidden
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">{org.ownerEmail}</td>
                <td className="px-4 py-3">
                  <PlanBadge plan={org.planLabel} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={org.liveStatus} />
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">
                  {org.monthly_fee != null ? Number(org.monthly_fee).toFixed(2) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">{org.memberCount}</td>
                <td className="px-4 py-3 text-right text-zinc-600">{org.workerCount}</td>
                <td className="px-4 py-3 text-zinc-500">{org.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="font-medium text-zinc-900 underline hover:text-zinc-700"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    'No Plan': 'bg-zinc-100 text-zinc-500',
    'Free Trial': 'bg-blue-50 text-blue-700',
    Basic: 'bg-amber-50 text-amber-700',
    Premium: 'bg-purple-50 text-purple-700',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[plan] ?? 'bg-zinc-100 text-zinc-600'}`}>
      {plan}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-zinc-100 text-zinc-600',
    trial: 'bg-blue-50 text-blue-700',
    trial_expired: 'bg-red-50 text-red-700',
    grace: 'bg-amber-50 text-amber-700',
    suspended: 'bg-red-50 text-red-700',
    cancelled: 'bg-zinc-100 text-zinc-500',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-zinc-100 text-zinc-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
