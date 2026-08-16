import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Use admin client to bypass RLS when checking user record
        const admin = createAdminClient()
        const { data: userRecord } = await admin
          .from('users')
          .select('id, space_id')
          .eq('id', user.id)
          .single()

        // If the user has a space, send them home (or to `next`)
        if (userRecord?.space_id) {
          return NextResponse.redirect(`${origin}${next === '/' ? '/' : next}`)
        }

        // New user with no space — check if `next` is a join link
        // If so, send them there (they're Partner B joining via invite)
        if (next && next.startsWith('/join/')) {
          return NextResponse.redirect(`${origin}${next}`)
        }

        // New user with no join context — send to onboarding
        return NextResponse.redirect(`${origin}/onboarding`)
      }
    }
  }

  // Auth failed — redirect with error
  return NextResponse.redirect(`${origin}/onboarding?error=auth`)
}
