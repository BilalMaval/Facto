import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getResilientUser } from '@/lib/supabase/resilientUser'
import { fetchWithTimeout } from '@/lib/supabase/timeoutFetch'
import '@/lib/supabase/envGuard'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout() },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const user = await getResilientUser(supabase)

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/invite') ||
    request.nextUrl.pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    const originalPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
    url.pathname = '/login'
    url.search = ''
    if (originalPath !== '/') {
      url.searchParams.set('next', originalPath)
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
