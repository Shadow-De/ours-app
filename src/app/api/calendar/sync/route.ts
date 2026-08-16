import { NextRequest, NextResponse } from "next/server";
import { createDecipheriv } from "crypto";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const { data: userData } = await supabase.from('users').select('*').eq('id', uid).single();

  if (!userData?.google_calendar_connected || !userData?.encrypted_refresh_token) {
    return null;
  }

  const refreshToken = decrypt(userData.encrypted_refresh_token);

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
 * - Updates google_event_id on the Supabase document after sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, docId, spaceId, assignedToRole } = body;

    if (!type || !docId || !spaceId || !assignedToRole) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    // Resolve assignee's UID from the space document
    const { data: spaceData } = await supabase.from('spaces').select('*').eq('id', spaceId).single();
    if (!spaceData) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }

    const assigneeUid =
      assignedToRole === "a"
        ? spaceData.partner_a_uid
        : spaceData.partner_b_uid;

    const assigneeName =
      assignedToRole === "a"
        ? spaceData.partner_a_real_name
        : spaceData.partner_b_real_name;

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

    // Fetch the document to get event details
    const tableName = type === "shift" ? "shifts" : "reminders";
    const { data } = await supabase.from(tableName).select('*').eq('id', docId).single();
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
      const dueDate = data.due_date;
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

    if (data.google_event_id) {
      // Update existing event
      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: data.google_event_id,
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

    // Store the event ID back on the Supabase document
    await supabase.from(tableName).update({ google_event_id: googleEventId }).eq('id', docId);

    return NextResponse.json({ success: true, googleEventId });
  } catch (error) {
    console.error("Calendar sync error:", error);
    return NextResponse.json({ error: "Calendar sync failed" }, { status: 500 });
  }
}
