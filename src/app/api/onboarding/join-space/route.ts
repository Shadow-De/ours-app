import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { spaceId, realName, nicknameForA } = await request.json();
    if (!spaceId || !realName) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // 1. Update space
    const { error: spaceError } = await supabase
      .from("spaces")
      .update({
        status: "active",
        partner_b_uid: user.id,
        partner_b_real_name: realName,
        partner_b_color_hex: "#5B5296",
        nickname_for_a: nicknameForA,
      })
      .eq("id", spaceId);

    if (spaceError) {
      console.error("Supabase update space error:", spaceError);
      return NextResponse.json({ error: "Failed to join space" }, { status: 500 });
    }

    // 2. Create user record
    const { error: userError } = await supabase
      .from("users")
      .upsert({
        id: user.id,
        space_id: spaceId,
        role: "b",
        google_calendar_connected: false,
      });

    if (userError) {
      console.error("Supabase upsert user error:", userError);
      return NextResponse.json({ error: "Failed to create user record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, spaceId });
  } catch (error) {
    console.error("Join space error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
