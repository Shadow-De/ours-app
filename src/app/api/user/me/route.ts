import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/user/me
 * Retrieves the current user's document from Supabase
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("users")
      .select("space_id, role, google_calendar_connected")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ exists: false, data: null });
    }

    return NextResponse.json({
      exists: true,
      data: {
        spaceId: data.space_id,
        role: data.role,
        googleCalendarConnected: data.google_calendar_connected,
      },
    });
  } catch (error) {
    console.error("GET /api/user/me error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
