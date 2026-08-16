import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // After successful auth, check if the user has a record in our users table
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userRecord } = await supabase
          .from('users')
          .select('id, space_id')
          .eq('id', user.id)
          .single()

        // New user (no record) or existing user with no space — send to onboarding
        if (!userRecord || !userRecord.space_id) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }

        // Existing user with a space — use next param or go home
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Auth failed — redirect with error
  return NextResponse.redirect(`${origin}/onboarding?error=auth`)
}
