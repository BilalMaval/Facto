import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/onboarding'

  const supabaseErrorDescription = searchParams.get('error_description')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    const message = error.message || 'Could not verify email — the link may have expired.'
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`)
  }

  const message = supabaseErrorDescription
    ? supabaseErrorDescription.replace(/\+/g, ' ')
    : 'Could not verify email — the link may have expired.'
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`)
}
