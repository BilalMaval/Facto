import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentMembership } from '@/lib/session'
import { getOwnerTier } from '@/lib/ownerPlan'
import { createClient } from '@/lib/supabase/server'
import { computeProratedUpgrade } from '@/lib/billing'
import { PaymentForm } from '../../../billing/PaymentForm'

const SUBMISSION_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

export default async function UpgradePage() {
  const { user, membership } = await getCurrentMembership()

  if (!user) redirect('/login')
  if (!membership) redirect('/onboarding')
  if (membership.role !== 'owner') redirect('/dashboard')

  const tier = await getOwnerTier(user.id)
  if (tier === 'premium') redirect('/dashboard/settings/new-business')

  const org = membership.organization
  const supabase = await createClient()
  const [{ data: settings }, { data: submissions }] = await Promise.all([
    supabase
      .from('platform_settings')
      .select(
        'easypaisa_number, easypaisa_title, easypaisa_note, jazzcash_number, jazzcash_title, jazzcash_note, bank_name, bank_account_title, bank_account_number, bank_iban, bank_note, multi_business_price'
      )
      .maybeSingle(),
    supabase
      .from('payment_submissions')
      .select('id, amount, method, transaction_reference, payment_date, status, submitted_at, review_note')
      .eq('submitted_by', user.id)
      .eq('purpose', 'plan_upgrade')
      .order('submitted_at', { ascending: false }),
  ])

  const price = Number(settings?.multi_business_price ?? 2599)
  const proration = computeProratedUpgrade(org, price)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/dashboard/settings" className="text-sm text-zinc-500 underline">
        ← Settings
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Unlock multiple businesses</h1>
      <p className="mt-1 text-sm text-zinc-500">
        A monthly add-on that unlocks adding more businesses and activates {org.name}&apos;s own
        subscription if it isn&apos;t already active. Billing then stays centralized here — every
        business you add afterward is included at no extra charge.
      </p>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Multi-business access</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          Rs. {Number(price).toLocaleString()}
          <span className="text-base font-normal text-zinc-500">/month</span>
        </p>
        <ul className="mt-4 space-y-1.5 text-sm text-zinc-600">
          <li className="flex gap-2">
            <span className="text-emerald-600">✓</span> Add unlimited additional businesses
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-600">✓</span> Switch between them from any dashboard screen
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-600">✓</span> Every additional business is included — no separate
            subscription needed
          </li>
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Pay to unlock</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Pay via Easypaisa, JazzCash, or bank transfer, then submit the details below. We&apos;ll verify,
          unlock multi-business access, and activate {org.name}&apos;s own subscription if it isn&apos;t
          already active.
        </p>
        {proration.credit > 0 && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            You have {proration.daysRemaining} day{proration.daysRemaining === 1 ? '' : 's'} remaining on{' '}
            {org.name}&apos;s current subscription — Rs. {proration.credit.toLocaleString()}{' '}
            of that is credited toward unlocking multi-business access, so it isn&apos;t wasted.{' '}
            <span className="font-medium">Amount to pay: Rs. {proration.amount.toLocaleString()}.</span>
          </div>
        )}
        <div className="mt-4">
          <PaymentForm
            organizationId={org.id}
            defaultAmount={proration.amount}
            purpose="plan_upgrade"
            successMessage="Request submitted — we'll review it, enable multi-business access, and activate your subscription shortly. You can track its status below."
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
          <h2 className="text-lg font-semibold text-zinc-900">Upgrade request history</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                  <th className="px-4 py-3">Date paid</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 text-zinc-600">{s.payment_date}</td>
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
