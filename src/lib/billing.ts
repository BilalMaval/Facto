import { addDays, today } from './dates'

export type BillingStatus = 'pending' | 'trial' | 'trial_expired' | 'active' | 'grace' | 'suspended' | 'cancelled'

const GRACE_DAYS = 5

export type OrgBillingFields = {
  subscription_status: string
  trial_ends_at: string | null
  subscribed_at: string | null
  paid_until: string | null
  suspension_note: string | null
}

export type BillingState = {
  status: BillingStatus
  trialEndsAt: string | null
  nextDueDate: string | null
  graceEndsAt: string | null
  suspensionNote: string | null
  daysRemaining: number | null
}

function daysBetween(fromDateStr: string, toDateStr: string) {
  const from = new Date(`${fromDateStr}T00:00:00Z`)
  const to = new Date(`${toDateStr}T00:00:00Z`)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

// Pure function of stored dates — no cron dependency. This is the single
// source of truth for both access gating (dashboard layout) and what the
// admin panel displays as the "live" status alongside the admin-controlled
// subscription_status column.
export function getBillingState(org: OrgBillingFields, asOf: string = today()): BillingState {
  // 'cancelled' and 'suspended' are manual admin overrides that always win,
  // regardless of what the billing dates say — this is what makes the admin
  // panel's "Suspended (blocks their access)" option actually do what it
  // says, instead of being silently ignored in favor of the date math below.
  if (org.subscription_status === 'cancelled' || org.subscription_status === 'suspended') {
    return {
      status: org.subscription_status as 'cancelled' | 'suspended',
      trialEndsAt: org.trial_ends_at,
      nextDueDate: null,
      graceEndsAt: null,
      suspensionNote: org.suspension_note,
      daysRemaining: null,
    }
  }

  if (!org.subscribed_at || !org.paid_until) {
    if (!org.trial_ends_at) {
      return {
        status: 'pending',
        trialEndsAt: null,
        nextDueDate: null,
        graceEndsAt: null,
        suspensionNote: null,
        daysRemaining: null,
      }
    }

    const trialEndDate = org.trial_ends_at.slice(0, 10)
    if (asOf <= trialEndDate) {
      return {
        status: 'trial',
        trialEndsAt: org.trial_ends_at,
        nextDueDate: null,
        graceEndsAt: null,
        suspensionNote: null,
        daysRemaining: daysBetween(asOf, trialEndDate),
      }
    }
    return {
      status: 'trial_expired',
      trialEndsAt: org.trial_ends_at,
      nextDueDate: null,
      graceEndsAt: null,
      suspensionNote: org.suspension_note,
      daysRemaining: null,
    }
  }

  const nextDueDate = addDays(org.paid_until, 1)
  const graceEndsAt = addDays(org.paid_until, 1 + GRACE_DAYS)

  if (asOf <= org.paid_until) {
    return {
      status: 'active',
      trialEndsAt: null,
      nextDueDate,
      graceEndsAt: null,
      suspensionNote: null,
      daysRemaining: daysBetween(asOf, org.paid_until),
    }
  }

  if (asOf <= graceEndsAt) {
    return {
      status: 'grace',
      trialEndsAt: null,
      nextDueDate,
      graceEndsAt,
      suspensionNote: null,
      daysRemaining: daysBetween(asOf, graceEndsAt),
    }
  }

  return {
    status: 'suspended',
    trialEndsAt: null,
    nextDueDate,
    graceEndsAt,
    suspensionNote: org.suspension_note,
    daysRemaining: null,
  }
}

export function isBlocked(status: BillingStatus) {
  return status === 'suspended' || status === 'trial_expired' || status === 'pending'
}

export type OrgPlanLabel = 'Free Trial' | 'Basic' | 'Premium'

// A single, always-accurate tier label — computed, never hand-typed, so
// there's nothing for an admin to forget to update. "Premium" reflects the
// owner's multi-business entitlement (owner_plans), which is why it can
// apply even to an org that hasn't made its own first payment yet: the
// tier belongs to the owner, not any one business.
export function deriveOrgPlan(subscribedAt: string | null, ownerHasMultiBusiness: boolean): OrgPlanLabel {
  if (ownerHasMultiBusiness) return 'Premium'
  if (subscribedAt) return 'Basic'
  return 'Free Trial'
}

export type ProratedUpgrade = {
  amount: number
  credit: number
  daysRemaining: number
}

// Credits the unused days of the org's current paid period against the
// upgrade price, so switching plans mid-cycle doesn't waste money already
// paid — only applies while the org is genuinely 'active' (paid and current);
// trial/grace/suspended/pending orgs have nothing paid-and-unused to credit.
export function computeProratedUpgrade(
  org: OrgBillingFields & { monthly_fee: number | null },
  upgradePrice: number,
  asOf: string = today()
): ProratedUpgrade {
  const billing = getBillingState(org, asOf)
  if (billing.status !== 'active' || !org.paid_until || !org.monthly_fee) {
    return { amount: upgradePrice, credit: 0, daysRemaining: 0 }
  }

  const daysRemaining = Math.max(0, billing.daysRemaining ?? 0)
  const dailyRate = Number(org.monthly_fee) / 30
  const credit = Math.round(dailyRate * daysRemaining * 100) / 100
  const amount = Math.max(0, Math.round((upgradePrice - credit) * 100) / 100)

  return { amount, credit, daysRemaining }
}
