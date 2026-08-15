import { NextRequest, NextResponse } from "next/server";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Lazily initialize Firebase Admin SDK to avoid build-time initialization.
 * Returns auth and db handles.
 */
function getAdminServices() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^"|"$/g, ''),
      }),
    });
  }
  return { adminAuth: getAuth(), adminDb: getFirestore() };
}

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
 * Receives a Firebase ID token, verifies it, and stores the Google OAuth
 * refresh token encrypted in users/{uid}.encryptedRefreshToken.
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

    const { adminAuth, adminDb } = getAdminServices();
    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const body = await request.json();

    // If a refresh token is provided (from a client-side OAuth flow), store it
    if (body.refreshToken) {
      const encrypted = encrypt(body.refreshToken);
      await adminDb.collection("users").doc(uid).update({
        encryptedRefreshToken: encrypted,
        googleCalendarConnected: true,
      });
    } else {
      // Just mark the user as having completed auth setup
      // The actual refresh token is obtained via Google OAuth code flow
      // In a full production deployment, this would be called with the code from the OAuth callback
      await adminDb.collection("users").doc(uid).set({
        googleCalendarConnected: false,
      }, { merge: true });
    }

    // CRITICAL: Never return any token data to the client
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Token storage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
