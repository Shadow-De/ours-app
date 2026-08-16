import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getAuthenticatedUser } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/create-space
 * Creates the space and user documents in Supabase PostgreSQL.
 * Uses admin (service role) client to bypass RLS entirely.
 *
 * Body: { name: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user } = auth;
    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Always use admin client (service role) — bypasses RLS entirely
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
      console.error("Supabase insert space error:", JSON.stringify(spaceError));
      return NextResponse.json(
        { error: "Failed to create space: " + (spaceError?.message || spaceError?.details || "unknown") },
        { status: 500 }
      );
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
      console.error("Supabase upsert user error:", JSON.stringify(userError));
      await admin.from("spaces").delete().eq("id", spaceId);
      return NextResponse.json(
        { error: "Failed to create user record: " + (userError.message || userError.details || "unknown") },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, spaceId });
  } catch (error) {
    console.error("Create space error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
