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
 * POST /api/onboarding/create-space
 * Creates the space and user documents server-side via Firestore REST API.
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

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = decodeJwt(idToken);
    if (!decodedToken || !decodedToken.user_id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const uid = decodedToken.user_id;

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const spaceId = crypto.randomUUID();
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ours-ef861";

    // Use Firestore REST API batch commit
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
    const body = {
      writes: [
        {
          update: {
            name: `projects/${projectId}/databases/(default)/documents/spaces/${spaceId}`,
            fields: {
              status: { stringValue: "awaiting_partner" },
              partnerA: {
                mapValue: {
                  fields: {
                    uid: { stringValue: uid },
                    realName: { stringValue: name.trim() },
                    colorHex: { stringValue: "#2F6E62" },
                  }
                }
              },
              nicknames: {
                mapValue: {
                  fields: {
                    forA: { stringValue: "" },
                    forB: { stringValue: "" },
                  }
                }
              },
              createdAt: { timestampValue: new Date().toISOString() },
            }
          }
        },
        {
          update: {
            name: `projects/${projectId}/databases/(default)/documents/users/${uid}`,
            fields: {
              spaceId: { stringValue: spaceId },
              role: { stringValue: "a" },
              googleCalendarConnected: { booleanValue: false },
              createdAt: { timestampValue: new Date().toISOString() },
            }
          }
        }
      ]
    };

    const res = await fetch(commitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Firestore REST error:", errorText);
      throw new Error(`Firestore API returned ${res.status}: ${errorText.substring(0, 50)}`);
    }

    return NextResponse.json({ success: true, spaceId });
  } catch (error) {
    console.error("Create space error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
