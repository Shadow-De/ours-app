import { NextRequest, NextResponse } from "next/server";
import { createUserClient, createAdminClient, getAuthenticatedUser } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/create-space
 * Creates the space and user documents in Supabase PostgreSQL.
 *
 * Body: { name: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, accessToken } = auth;
    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Use user's own JWT to authenticate — RLS will allow the user to operate on their own data
    // Fall back to admin client if service role key is available (bypasses RLS entirely)
    const db = accessToken ? createUserClient(accessToken) : createAdminClient();

    // 1. Create the space (RLS policy: "Users can insert a space" allows any auth'd user)
    const { data: spaceData, error: spaceError } = await db
      .from("spaces")
      .insert({
        status: "awaiting_partner",
        partner_a_uid: user.id,
        partner_a_real_name: name.trim(),
        partner_a_color_hex: "#2F6E62",
        nickname_for_a: "",
        nickname_for_b: "",
      })
      .select("id")
      .single();

    if (spaceError || !spaceData) {
      console.error("Supabase insert space error:", JSON.stringify(spaceError));
      return NextResponse.json(
        { error: "Failed to create space: " + (spaceError?.message || spaceError?.details || "unknown error") },
        { status: 500 }
      );
    }

    const spaceId = spaceData.id;

    // 2. Create or update the user record
    // RLS policy: "Users can insert their own profile" — requires id = auth.uid()
    // This works with createUserClient since the JWT sets auth.uid() correctly
    const { error: userError } = await db
      .from("users")
      .upsert({
        id: user.id,
        space_id: spaceId,
        role: "a",
        google_calendar_connected: false,
      });

    if (userError) {
      console.error("Supabase upsert user error:", JSON.stringify(userError));
      // Try cleanup
      await db.from("spaces").delete().eq("id", spaceId);
      return NextResponse.json(
        { error: "Failed to create user record: " + (userError.message || userError.details || "unknown error") },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, spaceId });
  } catch (error) {
    console.error("Create space error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
