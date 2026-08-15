"use client";

import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { toDateString } from "@/lib/utils";

interface AddReminderModalProps {
  onClose: () => void;
  spaceId: string;
}

export default function AddReminderModal({ onClose, spaceId }: AddReminderModalProps) {
  const { role, displayName } = useAuth();
  const [text, setText] = useState("");
  const [assignedTo, setAssignedTo] = useState<"a" | "b">(role ?? "a");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<string | null>(null);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, "spaces", spaceId, "reminders"), {
        text: text.trim(),
        assignedTo,
        assignedBy: role,
        dueDate: dueDate || null,
        done: false,
        googleEventId: null,
        createdAt: new Date().toISOString(),
      });

      // Auto-sync to assignee's Google Calendar if due date is set
      if (dueDate) {
        try {
          const resp = await fetch("/api/calendar/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "reminder",
              docId: docRef.id,
              spaceId,
              assignedToRole: assignedTo,
            }),
          });
          const data = await resp.json();
          if (data.warning) {
            setCalendarMsg(data.warning);
            setTimeout(onClose, 2500);
            return;
          }
        } catch {
          // Non-fatal
        }
      }

      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <Modal title="Add Nudge" onClose={onClose}>
      <div className="space-y-4">
        {/* Reminder text */}
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">
            What needs doing?
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Book dentist appointment"
            autoFocus
            className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans focus:outline-none focus:ring-2 focus:ring-partner-a"
          />
        </div>

        {/* Assign to */}
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">
            For
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["a", "b"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setAssignedTo(p)}
                className={`py-2.5 rounded-xl text-sm font-sans font-medium transition-colors ${
                  assignedTo === p
                    ? p === "a"
                      ? "bg-partner-a text-background"
                      : "bg-partner-b text-background"
                    : "bg-surface border-none text-muted"
                }`}
              >
                {displayName(p)}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">
            Due date <span className="text-muted">(optional — adds to their calendar)</span>
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            min={toDateString(new Date())}
            className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans focus:outline-none focus:ring-2 focus:ring-partner-a"
          />
        </div>

        {calendarMsg && (
          <p className="text-sm text-shared-gold font-sans bg-shared-gold/10 rounded-lg px-3 py-2">
            ⚠️ {calendarMsg}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="w-full py-3.5 bg-shared-gold text-background font-sans font-medium rounded-xl hover:bg-shared-gold/90 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shared-gold"
        >
          {saving ? "Saving…" : "Send nudge"}
        </button>
      </div>
    </Modal>
  );
}
