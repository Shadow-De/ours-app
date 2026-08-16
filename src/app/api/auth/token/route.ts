import { NextRequest, NextResponse } from "next/server";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createUserClient, createAdminClient, getAuthenticatedUser } from "@/lib/supabase/server";

function encrypt(plaintext: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex");
  const [ivHex, tagHex, dataHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

/**
 * POST /api/auth/token
 * Stores the Google OAuth refresh token encrypted in users table
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, accessToken } = auth;
    const body = await request.json();
    const db = accessToken ? createUserClient(accessToken) : createAdminClient();

    if (body.refreshToken) {
      const encrypted = encrypt(body.refreshToken);
      const { error } = await db
        .from("users")
        .update({
          encrypted_refresh_token: encrypted,
          google_calendar_connected: true,
        })
        .eq("id", user.id);

      if (error) {
        console.error("Supabase error saving token:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    } else {
      const { error } = await db
        .from("users")
        .update({ google_calendar_connected: false })
        .eq("id", user.id);

      if (error) {
        console.error("Supabase error updating user:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Token storage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
