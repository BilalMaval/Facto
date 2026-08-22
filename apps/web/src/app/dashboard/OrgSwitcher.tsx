'use client'

import { useRef } from 'react'
import { switchActiveOrganization } from './actions'

type Membership = { organizationId: string; orgName: string; role: string }

export function OrgSwitcher({
  memberships,
  activeOrgId,
}: {
  memberships: Membership[]
  activeOrgId: string
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={switchActiveOrganization}>
      <select
        name="organizationId"
        defaultValue={activeOrgId}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-semibold text-zinc-900"
      >
        {memberships.map((m) => (
          <option key={m.organizationId} value={m.organizationId}>
            {m.orgName}
          </option>
        ))}
      </select>
    </form>
  )
}
