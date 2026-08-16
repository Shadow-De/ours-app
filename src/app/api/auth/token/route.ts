import { NextRequest, NextResponse } from "next/server";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

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

function decodeJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/token
 * Receives a Firebase ID token, verifies it, and stores the Google OAuth
 * refresh token encrypted in users/{uid}.encryptedRefreshToken via REST API.
 *
 * This is the ONLY server route that handles tokens.
 * Refresh tokens are NEVER returned to the client.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = decodeJwt(idToken);
    if (!decodedToken || !decodedToken.user_id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const uid = decodedToken.user_id;

    const body = await request.json();
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ours-ef861";

    // If a refresh token is provided (from a client-side OAuth flow), store it
    if (body.refreshToken) {
      const encrypted = encrypt(body.refreshToken);
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=encryptedRefreshToken&updateMask.fieldPaths=googleCalendarConnected`;
      const patchBody = {
        fields: {
          encryptedRefreshToken: { stringValue: encrypted },
          googleCalendarConnected: { booleanValue: true },
        }
      };

      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(patchBody),
      });

      if (!res.ok) {
        throw new Error(`Firestore REST error: ${await res.text()}`);
      }
    } else {
      // Just mark the user as having completed auth setup
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=googleCalendarConnected`;
      const patchBody = {
        fields: {
          googleCalendarConnected: { booleanValue: false },
        }
      };

      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(patchBody),
      });

      if (!res.ok) {
        throw new Error(`Firestore REST error: ${await res.text()}`);
      }
    }

    // CRITICAL: Never return any token data to the client
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Token storage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
