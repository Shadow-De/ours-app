"use client";

import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { computeHours, getWeekOf, toDateString } from "@/lib/utils";
import { format, addDays, startOfWeek } from "date-fns";

interface AddShiftModalProps {
  onClose: () => void;
  spaceId: string;
  defaultDay?: string;
}

export default function AddShiftModal({ onClose, spaceId, defaultDay }: AddShiftModalProps) {
  const { role, displayName } = useAuth();
  const [person, setPerson] = useState<"a" | "b">(role ?? "a");
  const [day, setDay] = useState(defaultDay ?? toDateString(new Date()));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [wfh, setWfh] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<string | null>(null);

  const hours = computeHours(start, end);
  const weekOf = getWeekOf(new Date(day + "T00:00:00"));

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, "spaces", spaceId, "shifts"), {
        person,
        day,
        start,
        end,
        wfh,
        hours,
        weekOf,
        assignedBy: role,
        googleEventId: null,
        createdAt: new Date().toISOString(),
      });

      // Trigger calendar sync server-side
      try {
        const resp = await fetch("/api/calendar/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "shift",
            docId: docRef.id,
            spaceId,
            assignedToRole: person,
          }),
        });
        const data = await resp.json();
        if (data.warning) {
          setCalendarMsg(data.warning);
          // Still close after showing message
          setTimeout(onClose, 2500);
          return;
        }
      } catch {
        // Non-fatal — shift saved, calendar just won't sync
      }

      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  // Generate the 7 days of the current week for the day selector
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { value: toDateString(d), label: format(d, "EEE d") };
  });

  return (
    <Modal title="Log Shift" onClose={onClose}>
      <div className="space-y-4">
        {/* For whom */}
        <div>
          <label className="block text-sm font-sans font-medium text-ink/70 mb-1.5">
            For
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["a", "b"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPerson(p)}
                className={`py-2.5 rounded-xl text-sm font-sans font-medium transition-colors ${
                  person === p
                    ? p === "a"
                      ? "bg-partner-a text-white"
                      : "bg-partner-b text-white"
                    : "bg-white border border-border text-ink/50"
                }`}
              >
                {displayName(p)}
              </button>
            ))}
          </div>
        </div>

        {/* Day */}
        <div>
          <label className="block text-sm font-sans font-medium text-ink/70 mb-1.5">
            Day
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {weekDays.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDay(value)}
                className={`px-3 py-2 rounded-lg text-xs font-sans font-medium transition-colors ${
                  day === value
                    ? "bg-partner-a text-white"
                    : "bg-white border border-border text-ink/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="mt-2 w-full bg-white border border-border rounded-xl px-4 py-2.5 text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-partner-a"
          />
        </div>

        {/* Time range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-sans font-medium text-ink/70 mb-1.5">
              Start
            </label>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full bg-white border border-border rounded-xl px-4 py-3 text-ink font-mono focus:outline-none focus:ring-2 focus:ring-partner-a"
            />
          </div>
          <div>
            <label className="block text-sm font-sans font-medium text-ink/70 mb-1.5">
              End
            </label>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full bg-white border border-border rounded-xl px-4 py-3 text-ink font-mono focus:outline-none focus:ring-2 focus:ring-partner-a"
            />
          </div>
        </div>

        {/* Computed hours */}
        {hours > 0 && (
          <p className="text-sm font-mono text-ink/60 text-center">
            {hours.toFixed(1)} hours
          </p>
        )}

        {/* WFH toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={`w-11 h-6 rounded-full transition-colors relative ${
              wfh ? "bg-partner-a" : "bg-muted"
            }`}
            onClick={() => setWfh(!wfh)}
            role="switch"
            aria-checked={wfh}
            tabIndex={0}
            onKeyDown={(e) => e.key === " " && setWfh(!wfh)}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                wfh ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </div>
          <span className="text-sm font-sans text-ink">Working from home 🏠</span>
        </label>

        {/* Calendar sync message */}
        {calendarMsg && (
          <p className="text-sm text-shared-gold font-sans bg-shared-gold/10 rounded-lg px-3 py-2">
            ⚠️ {calendarMsg}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={hours <= 0 || saving}
          className="w-full py-3.5 bg-partner-a text-white font-sans font-medium rounded-xl hover:bg-partner-a/90 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
        >
          {saving ? "Saving…" : "Save shift"}
        </button>
      </div>
    </Modal>
  );
}
