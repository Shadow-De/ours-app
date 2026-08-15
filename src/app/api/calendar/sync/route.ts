import { NextRequest, NextResponse } from "next/server";
import { createDecipheriv } from "crypto";
import { google } from "googleapis";

/**
 * Lazily initialize Firebase Admin SDK.
 * Avoids build-time initialization when env vars aren't set.
 */
function getAdminDb() {
  const { getApps, initializeApp, cert } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

/**
 * Decrypt a token stored with AES-256-GCM.
 */
function decrypt(ciphertext: string): string {
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
 * Get a Google Calendar-authorized client for a specific user.
 * CRITICAL: Uses ONLY the assignee's refresh token — never the creator's.
 * This enforces per-owner calendar isolation.
 */
async function getCalendarClientForUser(uid: string) {
  const adminDb = getAdminDb();
  const userDoc = await adminDb.collection("users").doc(uid).get();
  const userData = userDoc.data();

  if (!userData?.googleCalendarConnected || !userData?.encryptedRefreshToken) {
    return null;
  }

  const refreshToken = decrypt(userData.encryptedRefreshToken);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * POST /api/calendar/sync
 *
 * Syncs a shift or reminder to the ASSIGNEE's Google Calendar.
 * Per Section 6.6 / Section 8 of spec:
 * - Only the assignee's calendar is written to, using their OWN refresh token
 * - The creator's identity (assignedBy) is irrelevant to which calendar is written
 * - If assignee hasn't connected calendar, returns a warning (not an error)
 * - Updates googleEventId on the Firestore document after sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, docId, spaceId, assignedToRole } = body;

    if (!type || !docId || !spaceId || !assignedToRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const adminDb = getAdminDb();

    // Resolve assignee's UID from the space document
    const spaceDoc = await adminDb.collection("spaces").doc(spaceId).get();
    const spaceData = spaceDoc.data();
    if (!spaceData) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const assigneeUid =
      assignedToRole === "a"
        ? spaceData.partnerA?.uid
        : spaceData.partnerB?.uid;

    const assigneeName =
      assignedToRole === "a"
        ? spaceData.partnerA?.realName
        : spaceData.partnerB?.realName;

    if (!assigneeUid) {
      return NextResponse.json(
        { warning: `Partner hasn't joined yet, so this won't sync to their calendar.` },
        { status: 200 }
      );
    }

    // Get calendar client using ONLY the assignee's token
    const calendar = await getCalendarClientForUser(assigneeUid);

    if (!calendar) {
      return NextResponse.json(
        {
          warning: `${assigneeName} hasn't connected their Google Calendar yet. This item was saved but won't sync automatically.`
        },
        { status: 200 }
      );
    }

    // Fetch the Firestore document to get event details
    const docRef = adminDb
      .collection("spaces").doc(spaceId)
      .collection(type === "shift" ? "shifts" : "reminders")
      .doc(docId);

    const docSnap = await docRef.get();
    const data = docSnap.data();
    if (!data) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    let event: Record<string, unknown>;

    if (type === "shift") {
      // Build calendar event for a shift
      const start = new Date(`${data.day}T${data.start}:00`);
      const end = new Date(`${data.day}T${data.end}:00`);

      event = {
        summary: `Work${data.wfh ? " (WFH 🏠)" : ""}`,
        description: `Shift logged via Us. app\nHours: ${data.hours.toFixed(1)}`,
        start: {
          dateTime: start.toISOString(),
          timeZone: "Europe/London",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "Europe/London",
        },
        colorId: assignedToRole === "a" ? "2" : "9", // Sage (A) or Blueberry (B)
      };
    } else {
      // Build calendar event for a reminder
      const dueDate = data.dueDate;
      if (!dueDate) {
        return NextResponse.json({ success: true, skipped: "No due date" });
      }

      event = {
        summary: data.text,
        description: `Reminder set via Us. app`,
        start: { date: dueDate },
        end: { date: dueDate },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 60 }],
        },
      };
    }

    let googleEventId: string;

    if (data.googleEventId) {
      // Update existing event
      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: data.googleEventId,
        requestBody: event,
      });
      googleEventId = response.data.id!;
    } else {
      // Create new event
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
      });
      googleEventId = response.data.id!;
    }

    // Store the event ID back on the Firestore document
    await docRef.update({ googleEventId });

    return NextResponse.json({ success: true, googleEventId });
  } catch (error) {
    console.error("Calendar sync error:", error);
    return NextResponse.json({ error: "Calendar sync failed" }, { status: 500 });
  }
}
