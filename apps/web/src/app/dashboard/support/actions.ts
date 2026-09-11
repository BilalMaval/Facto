'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { notifyTicketReply } from '@/lib/push/notify'

export type FormState = { error?: string; success?: boolean } | null

export async function createTicket(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations()
  const organizationId = String(formData.get('organizationId') ?? '')
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()

  if (!subject || !body) {
    return { error: t('support.errors.subjectAndMessageRequired') }
  }

  const supabase = await createClient()
  const { data: ticketId, error } = await supabase.rpc('create_support_ticket', {
    p_org_id: organizationId,
    p_subject: subject,
    p_body: body,
  })

  if (error) {
    return { error: t('common.genericError') }
  }

  redirect(`/dashboard/support/${ticketId}`)
}

export async function postReply(_prevState: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations()
  const ticketId = String(formData.get('ticketId') ?? '')
  const body = String(formData.get('body') ?? '').trim()

  if (!body) {
    return { error: t('support.errors.messageCannotBeEmpty') }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('post_ticket_message', { p_ticket_id: ticketId, p_body: body })

  if (error) {
    return { error: t('common.genericError') }
  }

  after(() => notifyTicketReply(ticketId))
  revalidatePath(`/dashboard/support/${ticketId}`)
  return { success: true }
}

export async function closeTicket(formData: FormData) {
  const ticketId = String(formData.get('ticketId') ?? '')
  const supabase = await createClient()
  await supabase.rpc('set_ticket_status', { p_ticket_id: ticketId, p_status: 'closed' })
  revalidatePath(`/dashboard/support/${ticketId}`)
  revalidatePath('/dashboard/support')
}

export async function reopenTicket(formData: FormData) {
  const ticketId = String(formData.get('ticketId') ?? '')
  const supabase = await createClient()
  await supabase.rpc('set_ticket_status', { p_ticket_id: ticketId, p_status: 'open' })
  revalidatePath(`/dashboard/support/${ticketId}`)
  revalidatePath('/dashboard/support')
}
