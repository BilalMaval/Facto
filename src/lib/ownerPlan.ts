import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const getOwnerTier = cache(async function getOwnerTier(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('owner_plans').select('tier').eq('user_id', userId).maybeSingle()
  return (data?.tier as 'basic' | 'premium' | undefined) ?? 'basic'
})
