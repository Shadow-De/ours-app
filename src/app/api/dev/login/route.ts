import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: 'password123',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Redirect to onboarding so they enter the flow
  return NextResponse.redirect(new URL('/onboarding', request.url));
}
