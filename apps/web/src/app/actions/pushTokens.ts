'use server'

import { createClient } from '@/lib/supabase/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'

// Shared by both dashboard and admin contexts — a platform admin's own
// Android device needs to register too (they're a recipient of
// ticket-reply notifications the same way an org owner/admin is).
export async function saveDeviceToken(token: string) {
  const supabase = await createClient()
  const user = await getResilientUser(supabase)
  if (!user || !token) return

  await supabase
    .from('device_push_tokens')
    .upsert({ user_id: user.id, platform: 'android', token, updated_at: new Date().toISOString() }, { onConflict: 'platform,token' })
}
