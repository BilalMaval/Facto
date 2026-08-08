import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/platformAdmin'
import { AdminNav } from './AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (!(await isPlatformAdmin())) redirect('/dashboard')

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AdminNav userEmail={user.email ?? ''} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
