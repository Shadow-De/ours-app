import { NextRequest, NextResponse } from "next/server";
import { createUserClient, createAdminClient, getAuthenticatedUser } from "@/lib/supabase/server";

/**
 * GET /api/user/me
 * Retrieves the current user's document from Supabase
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, accessToken } = auth;
    const db = accessToken ? createUserClient(accessToken) : createAdminClient();

    const { data, error } = await db
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
