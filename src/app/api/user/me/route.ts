import { NextRequest, NextResponse } from "next/server";

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
 * GET /api/user/me
 * Returns the current user's Firestore document via Firestore REST API.
 * Used as a fallback when the browser Firestore client is offline.
 *
 * Auth: Bearer <Firebase ID Token>
 */
export async function GET(request: NextRequest) {
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

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ours-ef861";
    const getUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;

    const res = await fetch(getUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (res.status === 404) {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Firestore REST error:", errorText);
      throw new Error(`Firestore API returned ${res.status}: ${errorText.substring(0, 50)}`);
    }

    const data = await res.json();
    
    // Convert Firestore Document format to normal JS object
    const userData: any = {};
    if (data.fields) {
      for (const [key, value] of Object.entries(data.fields)) {
        const val = value as any;
        userData[key] = val.stringValue ?? val.booleanValue ?? val.integerValue ?? val.timestampValue ?? null;
      }
    }

    return NextResponse.json({ exists: true, data: userData });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
