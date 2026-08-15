import { NextRequest, NextResponse } from "next/server";

/**
 * Lazily initialize Firebase Admin SDK.
 */
function getAdminServices() {
  const { getAuth } = require("firebase-admin/auth");
  const { getFirestore } = require("firebase-admin/firestore");
  const { getApps, initializeApp, cert } = require("firebase-admin/app");

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").replace(/^"|"$/g, ""),
      }),
    });
  }
  return { adminAuth: getAuth(), adminDb: getFirestore() };
}

/**
 * POST /api/onboarding/create-space
 * Creates the space and user documents server-side via Admin SDK.
 * Bypasses the browser Firestore WebChannel which can get stuck offline.
 *
 * Body: { name: string }
 * Auth: Bearer <Firebase ID Token>
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

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const spaceId = crypto.randomUUID();

    // Use a batch write for atomicity
    const batch = adminDb.batch();

    batch.set(adminDb.collection("spaces").doc(spaceId), {
      status: "awaiting_partner",
      partnerA: {
        uid,
        realName: name.trim(),
        colorHex: "#2F6E62",
      },
      partnerB: null,
      nicknames: { forA: "", forB: "" },
      createdAt: new Date().toISOString(),
    });

    batch.set(adminDb.collection("users").doc(uid), {
      spaceId,
      role: "a",
      googleCalendarConnected: false,
      createdAt: new Date().toISOString(),
    });

    await batch.commit();

    return NextResponse.json({ success: true, spaceId });
  } catch (error) {
    console.error("Create space error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
