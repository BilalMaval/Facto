import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // manifest.webmanifest joins favicon.ico here for the same reason: it's
    // a public, unauthenticated static asset (Chrome's own installability
    // check fetches it with no session), so it must never be redirected to
    // /login the way a gated page would be.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
