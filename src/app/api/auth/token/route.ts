import { NextRequest, NextResponse } from "next/server";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createAdminClient, getAuthenticatedUser } from "@/lib/supabase/server";

/**
 * AES-256-GCM encryption for refresh tokens.
 * Key must be 32 bytes (256 bits), stored in TOKEN_ENCRYPTION_KEY env var.
 */
function encrypt(plaintext: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
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
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const admin = createAdminClient();

    if (body.refreshToken) {
      const encrypted = encrypt(body.refreshToken);
      const { error } = await admin
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
      // Just mark the user as having completed auth setup
      const { error } = await admin
        .from("users")
        .update({
          google_calendar_connected: false,
        })
        .eq("id", user.id);

      if (error) {
        console.error("Supabase error updating user:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    }

    // CRITICAL: Never return any token data to the client
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Token storage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
