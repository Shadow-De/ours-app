import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — ignore
        }
      },
    },
  });
}

/**
 * Creates a Supabase client with the service role key — bypasses RLS.
 * Only use in trusted server routes.
 */
export function createAdminClient() {
  // Use service role key if available, otherwise anon key
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Creates a Supabase client authenticated with a specific user JWT.
 * This allows the client to make requests that respect RLS policies
 * with the user's identity, without needing a service role key.
 */
export function createUserClient(accessToken: string) {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Gets the authenticated user from Bearer token or cookies.
 * Returns both the user AND the access token for use with createUserClient.
 */
export async function getAuthenticatedUser(
  request?: NextRequest
): Promise<{ user: any; accessToken: string | null } | null> {
  // 1. Try Bearer token first
  if (request) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      if (token && token !== "undefined" && token !== "null") {
        // Validate via the anon client's auth endpoint (works without service key)
        const tempClient = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: { user }, error } = await tempClient.auth.getUser(token);
        if (!error && user) return { user, accessToken: token };
      }
    }
  }

  // 2. Fallback to cookie-based session
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return { user: session.user, accessToken: session.access_token };
    }
  } catch {
    // ignore
  }

  return null;
}
