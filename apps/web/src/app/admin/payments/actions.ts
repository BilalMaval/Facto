'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyPaymentReviewed } from '@/lib/push/notify'

export type FormState = { error?: string } | null

export async function reviewPaymentSubmission(_prevState: FormState, formData: FormData): Promise<FormState> {
  const submissionId = String(formData.get('submissionId') ?? '')
  const approve = formData.get('approve') === 'true'
  const note = String(formData.get('note') ?? '').trim()

  const supabase = await createClient()
  // Same codegen gap noted in src/app/admin/actions.ts — p_note is a
  // nullable Postgres param but generated types don't reflect that.
  const { error } = await supabase.rpc('review_payment_submission', {
    p_submission_id: submissionId,
    p_approve: approve,
    p_note: note || null,
  } as unknown as Parameters<typeof supabase.rpc<'review_payment_submission'>>[1])

  if (error) {
    return { error: error.message }
  }

  after(() => notifyPaymentReviewed(submissionId, approve))
  revalidatePath('/admin/payments')
  revalidatePath('/admin')
  revalidatePath('/admin/organizations/[id]', 'page')
  return null
}
