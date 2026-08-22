import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { getBillingState } from '@/lib/billing'
import { formatDate, type DateFormat } from '@/lib/dates'
import { PaymentForm } from './PaymentForm'
import { StartTrialButton } from './StartTrialButton'

const STATUS_LABELS: Record<string, string> = {
  pending: 'No plan chosen',
  trial: 'Free trial',
  trial_expired: 'Trial expired',
  active: 'Active',
  grace: 'Payment overdue',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  trial: 'bg-blue-50 text-blue-700',
  trial_expired: 'bg-red-50 text-red-700',
  active: 'bg-emerald-50 text-emerald-700',
  grace: 'bg-amber-50 text-amber-700',
  suspended: 'bg-red-50 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
}

const SUBMISSION_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

const PURPOSE_LABELS: Record<string, string> = {
  subscription: 'Subscription',
  plan_upgrade: 'Multi-business upgrade',
}

export default async function BillingPage() {
  const { user, membership, memberships, parentOrganizationId } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') redirect('/dashboard')

  const org = membership.organization
  const dateFormat = org.date_format as DateFormat

  // Billing is centralized to the owner's first (parent) business — 2nd+
  // businesses are auto-active under Premium and never carry their own
  // subscription, so paying, transaction history, and the status card all
  // read from the parent, no matter which business is currently active.
  const billingOrgId = parentOrganizationId ?? org.id
  const isChildBilling = billingOrgId !== org.id
  const parentOrgName = memberships.find((m) => m.organizationId === billingOrgId)?.orgName ?? org.name

  const supabase = await createClient()
  const [{ data: settings }, { data: submissions }, { data: parentOrgRow }] = await Promise.all([
    supabase
      .from('platform_settings')
      .select(
        'easypaisa_number, easypaisa_title, easypaisa_note, jazzcash_number, jazzcash_title, jazzcash_note, bank_name, bank_account_title, bank_account_number, bank_iban, bank_note, support_email, plan_price, plan_features'
      )
      .maybeSingle(),
    supabase
      .from('payment_submissions')
      .select('id, amount, method, transaction_reference, payment_date, status, submitted_at, review_note, purpose')
      .eq('organization_id', billingOrgId)
      .order('submitted_at', { ascending: false }),
    isChildBilling
      ? supabase
          .from('organizations')
          .select('subscription_status, trial_ends_at, subscribed_at, paid_until, suspension_note')
          .eq('id', billingOrgId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const billing = getBillingState(parentOrgRow ?? org)

  const planPrice = settings?.plan_price ?? 1599
  const planFeatures = settings?.plan_features ?? []

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Billing & plan</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {isChildBilling
          ? `Billing across your businesses is centralized under ${parentOrgName}'s subscription.`
          : <>Manage {org.name}&apos;s subscription.</>}
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Factory Salary Slip plan</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            Rs. {Number(planPrice).toLocaleString()}
            <span className="text-base font-normal text-zinc-500">/month</span>
          </p>
          {planFeatures.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-600">
              {planFeatures.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-emerald-600">✓</span> {f}
                </li>
              ))}
            </ul>
          )}
          {billing.status === 'pending' && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <StartTrialButton organizationId={billingOrgId} />
              <a
                href="#activate"
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Activate now
              </a>
            </div>
          )}
          {billing.status === 'trial' && (
            <p className="mt-5 text-sm text-zinc-500">
              You&apos;re exploring on a free trial. Activate anytime below to keep access after it ends.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Status</p>
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-1 text-sm font-medium ${STATUS_STYLES[billing.status] ?? 'bg-zinc-100 text-zinc-600'}`}
          >
            {STATUS_LABELS[billing.status] ?? billing.status}
          </span>

          <div className="mt-3 space-y-1 text-sm text-zinc-600">
            {billing.status === 'pending' && <p>Choose Free Trial or Activate Now to get started.</p>}
            {billing.status === 'trial' && billing.daysRemaining !== null && (
              <p>{billing.daysRemaining} day{billing.daysRemaining === 1 ? '' : 's'} left in your trial.</p>
            )}
            {billing.status === 'active' && billing.nextDueDate && (
              <p>Next payment due {formatDate(billing.nextDueDate, dateFormat)}.</p>
            )}
            {billing.status === 'grace' && (
              <p>
                Payment was due {formatDate(billing.nextDueDate!, dateFormat)}. Pay within {billing.daysRemaining} day
                {billing.daysRemaining === 1 ? '' : 's'} to avoid suspension.
              </p>
            )}
            {(billing.status === 'suspended' || billing.status === 'trial_expired') && (
              <p>
                {billing.suspensionNote || 'Submit a payment below to reactivate your account.'}
                {settings?.support_email && (
                  <>
                    {' '}
                    Need help? Email{' '}
                    <a href={`mailto:${settings.support_email}`} className="underline">
                      {settings.support_email}
                    </a>
                    .
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <div id="activate" className="mt-8 scroll-mt-20">
        <h2 className="text-lg font-semibold text-zinc-900">Activate now</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Pay via Easypaisa, JazzCash, or bank transfer, then submit the details below. We&apos;ll verify
          and activate your account.
          {isChildBilling && ` You can pay from any of your businesses — this will be credited to ${parentOrgName}.`}
        </p>
        <div className="mt-4">
          <PaymentForm
            organizationId={billingOrgId}
            defaultAmount={Number(planPrice)}
            dateFormat={org.date_format as DateFormat}
            settings={{
              easypaisa_number: settings?.easypaisa_number ?? null,
              easypaisa_title: settings?.easypaisa_title ?? null,
              easypaisa_note: settings?.easypaisa_note ?? null,
              jazzcash_number: settings?.jazzcash_number ?? null,
              jazzcash_title: settings?.jazzcash_title ?? null,
              jazzcash_note: settings?.jazzcash_note ?? null,
              bank_name: settings?.bank_name ?? null,
              bank_account_title: settings?.bank_account_title ?? null,
              bank_account_number: settings?.bank_account_number ?? null,
              bank_iban: settings?.bank_iban ?? null,
              bank_note: settings?.bank_note ?? null,
            }}
          />
        </div>
      </div>

      {submissions && submissions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Transaction history</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Every payment you&apos;ve submitted for {parentOrgName}, including subscription renewals and
            any multi-business upgrade — centralized here regardless of which of your businesses you
            paid from.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-3">Date paid</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 text-zinc-600">{formatDate(s.payment_date, dateFormat)}</td>
                    <td className="px-4 py-3 text-zinc-600">{PURPOSE_LABELS[s.purpose] ?? s.purpose}</td>
                    <td className="px-4 py-3 text-zinc-600">{s.method.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-zinc-600">{s.transaction_reference}</td>
                    <td className="px-4 py-3 text-right text-zinc-600">{Number(s.amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${SUBMISSION_STATUS_STYLES[s.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                      >
                        {s.status}
                      </span>
                      {s.status === 'rejected' && s.review_note && (
                        <p className="mt-1 text-xs text-zinc-400">{s.review_note}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
