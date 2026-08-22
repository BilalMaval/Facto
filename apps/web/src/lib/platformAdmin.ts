import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const isPlatformAdmin = cache(async function isPlatformAdmin() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('is_platform_admin')
  return Boolean(data)
})
