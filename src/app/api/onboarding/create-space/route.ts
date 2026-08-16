import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/create-space
 * Creates the space and user documents in Supabase PostgreSQL.
 * Uses the service role admin client to bypass RLS for initial user record creation.
 *
 * Body: { name: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated using their session cookie
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Use the admin client for writes to bypass RLS
    const admin = createAdminClient();

    // 1. Create the space
    const { data: spaceData, error: spaceError } = await admin
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
      console.error("Supabase insert space error:", spaceError);
      return NextResponse.json({ error: "Failed to create space" }, { status: 500 });
    }

    const spaceId = spaceData.id;

    // 2. Create or update the user record
    const { error: userError } = await admin
      .from("users")
      .upsert({
        id: user.id,
        space_id: spaceId,
        role: "a",
        google_calendar_connected: false,
      });

    if (userError) {
      console.error("Supabase upsert user error:", userError);
      // Clean up: delete the space since user creation failed
      await admin.from("spaces").delete().eq("id", spaceId);
      return NextResponse.json({ error: "Failed to create user record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, spaceId });
  } catch (error) {
    console.error("Create space error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
