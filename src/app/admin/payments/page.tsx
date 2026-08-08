import { createClient } from '@/lib/supabase/server'
import { ReviewForm } from './ReviewForm'
import { AdminFilterBar } from '../AdminFilterBar'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const PURPOSE_OPTIONS = [
  { value: '', label: 'All purposes' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'plan_upgrade', label: 'Plan upgrade' },
]

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; purpose?: string; from?: string; to?: string }>
}) {
  const { q = '', status = '', purpose = '', from = '', to = '' } = await searchParams
  const supabase = await createClient()

  const { data: submissions } = await supabase
    .from('payment_submissions')
    .select(
      'id, amount, method, transaction_reference, payment_date, proof_path, proof_filename, status, purpose, submitted_at, review_note, organization:organizations(name)'
    )
    .order('submitted_at', { ascending: false })

  let rows = await Promise.all(
    (submissions ?? []).map(async (s) => {
      const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(s.proof_path, 3600)
      const org = (Array.isArray(s.organization) ? s.organization[0] : s.organization) as {
        name: string
      } | null
      return { ...s, orgName: org?.name ?? '—', proofUrl: data?.signedUrl ?? null }
    })
  )

  if (q) {
    const needle = q.toLowerCase()
    rows = rows.filter((r) => {
      const haystack = [
        r.orgName,
        r.transaction_reference,
        r.method.replace('_', ' '),
        Number(r.amount).toFixed(2),
        r.payment_date,
        r.status,
        r.purpose === 'plan_upgrade' ? 'plan upgrade' : 'subscription',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }
  if (status) rows = rows.filter((r) => r.status === status)
  if (purpose) rows = rows.filter((r) => r.purpose === purpose)
  if (from) rows = rows.filter((r) => r.payment_date >= from)
  if (to) rows = rows.filter((r) => r.payment_date <= to)

  const pending = rows.filter((r) => r.status === 'pending')
  const reviewed = rows.filter((r) => r.status !== 'pending')

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
      <p className="mt-1 text-sm text-zinc-500">Review and approve submitted payment proofs.</p>

      <div className="mt-6">
        <AdminFilterBar
          basePath="/admin/payments"
          q={q}
          searchPlaceholder="Search anything — organization, reference, method, amount, status…"
          selects={[
            { name: 'status', value: status, options: STATUS_OPTIONS },
            { name: 'purpose', value: purpose, options: PURPOSE_OPTIONS },
          ]}
          dateRange={{ fromParam: 'from', toParam: 'to', fromValue: from, toValue: to }}
        />
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-zinc-400">
        Pending ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">Nothing waiting on review.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {pending.map((s) => (
            <div key={s.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:flex sm:gap-4">
              {s.proofUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.proofUrl}
                  alt="Payment proof"
                  className="h-32 w-32 flex-shrink-0 rounded-md border border-zinc-200 object-cover"
                />
              )}
              <div className="mt-3 flex-1 sm:mt-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900">{s.orgName}</p>
                  {s.purpose === 'plan_upgrade' && (
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                      Plan upgrade
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {s.method.replace('_', ' ')} · Rs. {Number(s.amount).toFixed(2)} · paid {s.payment_date}
                </p>
                <p className="text-xs text-zinc-400">Ref: {s.transaction_reference}</p>
                {s.proofUrl && (
                  <a
                    href={s.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 flex-shrink-0">
                      <path
                        fillRule="evenodd"
                        d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {s.proof_filename || 'View attachment'}
                  </a>
                )}
                <ReviewForm submissionId={s.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-zinc-400">Reviewed</h2>
      {reviewed.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">No reviewed submissions yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((s) => (
                <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 text-zinc-900">{s.orgName}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {s.purpose === 'plan_upgrade' ? 'Plan upgrade' : 'Subscription'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{s.method.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right text-zinc-600">{Number(s.amount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-zinc-600">{s.payment_date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
