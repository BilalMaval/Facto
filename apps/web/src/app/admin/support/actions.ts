'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type FormState = { error?: string; success?: boolean } | null

export async function postAdminReply(_prevState: FormState, formData: FormData): Promise<FormState> {
  const ticketId = String(formData.get('ticketId') ?? '')
  const body = String(formData.get('body') ?? '').trim()

  if (!body) {
    return { error: 'Message cannot be empty' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('post_ticket_message', { p_ticket_id: ticketId, p_body: body })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/admin/support/${ticketId}`)
  revalidatePath('/admin/support')
  return { success: true }
}

export async function closeTicket(formData: FormData) {
  const ticketId = String(formData.get('ticketId') ?? '')
  const supabase = await createClient()
  await supabase.rpc('set_ticket_status', { p_ticket_id: ticketId, p_status: 'closed' })
  revalidatePath(`/admin/support/${ticketId}`)
  revalidatePath('/admin/support')
}
