import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get('spaceId');

  if (!spaceId) {
    return NextResponse.json({ error: "Missing spaceId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: spaceData, error } = await admin
    .from("spaces")
    .select("id, status, partner_a_real_name")
    .eq("id", spaceId)
    .single();

  if (error || !spaceData) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }

  return NextResponse.json(spaceData);
}
