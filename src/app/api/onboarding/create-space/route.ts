import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/create-space
 * Creates the space and user documents in Supabase PostgreSQL.
 *
 * Body: { name: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Use a transaction/RPC or sequential inserts if RLS is configured appropriately
    // 1. Create the space
    const { data: spaceData, error: spaceError } = await supabase
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
    const { error: userError } = await supabase
      .from("users")
      .upsert({
        id: user.id,
        space_id: spaceId,
        role: "a",
        google_calendar_connected: false,
      });

    if (userError) {
      console.error("Supabase upsert user error:", userError);
      // Rollback space could be needed here, or RPC should be used.
      return NextResponse.json({ error: "Failed to create user record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, spaceId });
  } catch (error) {
    console.error("Create space error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
