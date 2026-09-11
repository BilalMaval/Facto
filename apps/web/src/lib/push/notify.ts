import { createClient } from '@/lib/supabase/server'
import { sendPushToTokens } from './fcm'

// The single place all 4 Server Action call sites reach into — each wraps
// its recipient-lookup RPC + the FCM send in one place, and never throws:
// a push failure must not fail the ticket reply / payment review / invite
// creation it's attached to.

export async function notifyTicketReply(ticketId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: tokens, error } = await supabase.rpc('get_ticket_reply_recipient_tokens', {
      p_ticket_id: ticketId,
    })
    if (error || !tokens) return
    await sendPushToTokens(tokens, {
      title: 'New support message',
      body: 'You have a new reply on your support ticket.',
      data: { type: 'ticket_reply', ticketId },
    })
  } catch (err) {
    console.error('notifyTicketReply failed', err)
  }
}

export async function notifyPaymentReviewed(submissionId: string, approved: boolean): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: tokens, error } = await supabase.rpc('get_payment_submission_recipient_tokens', {
      p_submission_id: submissionId,
    })
    if (error || !tokens) return
    await sendPushToTokens(tokens, {
      title: approved ? 'Payment approved' : 'Payment rejected',
      body: approved
        ? 'Your submitted payment has been approved.'
        : 'Your submitted payment was rejected — check the details.',
      data: { type: 'payment_reviewed', submissionId, approved: String(approved) },
    })
  } catch (err) {
    console.error('notifyPaymentReviewed failed', err)
  }
}

export async function notifyInviteCreated(invitationId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: tokens, error } = await supabase.rpc('get_invite_recipient_tokens', {
      p_invitation_id: invitationId,
    })
    if (error || !tokens) return
    // Empty when the invitee has no existing account/device — expected, not
    // an error (see get_invite_recipient_tokens's own comment).
    await sendPushToTokens(tokens, {
      title: 'Team invitation',
      body: "You've been invited to join a team on Facto.",
      data: { type: 'invite_created', invitationId },
    })
  } catch (err) {
    console.error('notifyInviteCreated failed', err)
  }
}
