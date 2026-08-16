import { NextRequest, NextResponse } from "next/server";
import { createUserClient, createAdminClient, getAuthenticatedUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, accessToken } = auth;
    const { spaceId, realName, nicknameForA } = await request.json();
    if (!spaceId || !realName) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Admin client to read/verify the space (needs to see it regardless of who owns it)
    const admin = createAdminClient();

    // 1. Verify the space exists and is awaiting a partner
    const { data: spaceData, error: spaceFetchError } = await admin
      .from("spaces")
      .select("id, status, partner_a_uid")
      .eq("id", spaceId)
      .single();

    if (spaceFetchError || !spaceData) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    if (spaceData.status !== "awaiting_partner") {
      return NextResponse.json({ error: "Space is already full" }, { status: 400 });
    }

    if (spaceData.partner_a_uid === user.id) {
      return NextResponse.json({ error: "You cannot join your own space" }, { status: 400 });
    }

    // Use user's JWT so RLS is satisfied for the write operations
    const db = accessToken ? createUserClient(accessToken) : admin;

    // 2. Update space to active with partner B info
    const { error: spaceError } = await admin
      .from("spaces")
      .update({
        status: "active",
        partner_b_uid: user.id,
        partner_b_real_name: realName,
        partner_b_color_hex: "#5B5296",
        nickname_for_a: nicknameForA || "",
      })
      .eq("id", spaceId);

    if (spaceError) {
      console.error("Supabase update space error:", JSON.stringify(spaceError));
      return NextResponse.json(
        { error: "Failed to join space: " + (spaceError.message || spaceError.details || "unknown error") },
        { status: 500 }
      );
    }

    // 3. Create user record for partner B
    const { error: userError } = await db
      .from("users")
      .upsert({
        id: user.id,
        space_id: spaceId,
        role: "b",
        google_calendar_connected: false,
      });

    if (userError) {
      console.error("Supabase upsert user error:", JSON.stringify(userError));
      return NextResponse.json(
        { error: "Failed to create user record: " + (userError.message || userError.details || "unknown error") },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, spaceId });
  } catch (error) {
    console.error("Join space error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
