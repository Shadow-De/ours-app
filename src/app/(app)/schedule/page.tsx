"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc, orderBy
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, addWeeks, startOfWeek, addDays, eachDayOfInterval } from "date-fns";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider } from "@/components/Braid";
import { cn, getWeekOf, toDateString, computeHours } from "@/lib/utils";
import { Shift, Reminder, Chore, Role } from "@/lib/types";
import AddShiftModal from "@/components/modals/AddShiftModal";
import AddReminderModal from "@/components/modals/AddReminderModal";
import AddChoreModal from "@/components/modals/AddChoreModal";

export default function SchedulePage() {
  const { spaceId, role, displayName } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [showAddChore, setShowAddChore] = useState(false);

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  const weekEnd = addDays(weekStart, 6);
  const weekOf = toDateString(weekStart);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    if (!spaceId) return;
    const unsubs: (() => void)[] = [];

    // Shifts for this week
    const shiftsQ = query(
      collection(db, "spaces", spaceId, "shifts"),
      where("weekOf", "==", weekOf)
    );
    unsubs.push(onSnapshot(shiftsQ, (snap) => {
      setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift)));
    }));

    // All undone reminders
    const remQ = query(
      collection(db, "spaces", spaceId, "reminders"),
      where("done", "==", false),
      orderBy("dueDate", "asc")
    );
    unsubs.push(onSnapshot(remQ, (snap) => {
      setReminders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reminder)));
    }));

    // Chores
    unsubs.push(onSnapshot(collection(db, "spaces", spaceId, "chores"), (snap) => {
      setChores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chore)));
    }));

    return () => unsubs.forEach((u) => u());
  }, [spaceId, weekOf]);

  // Hours totals
  const aHours = shifts.filter((s) => s.person === "a").reduce((sum, s) => sum + s.hours, 0);
  const bHours = shifts.filter((s) => s.person === "b").reduce((sum, s) => sum + s.hours, 0);

  const markChoreDone = async (chore: Chore) => {
    if (!spaceId) return;
    await updateDoc(doc(db, "spaces", spaceId, "chores", chore.id), {
      turn: chore.turn === "a" ? "b" : "a",
      lastDoneBy: chore.turn,
      lastDoneAt: new Date().toISOString(),
    });
  };

  const markReminderDone = async (id: string) => {
    if (!spaceId) return;
    await updateDoc(doc(db, "spaces", spaceId, "reminders", id), { done: true });
  };

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <header className="mb-1">
        <h1 className="font-display text-4xl font-light text-ink">Week</h1>
      </header>
      <BraidDivider className="mb-4" />

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-5 h-5 text-ink/60" />
        </button>
        <span className="font-sans font-semibold text-ink">
          {format(weekStart, "MMM d")}–{format(weekEnd, "d")}
        </span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
          aria-label="Next week"
        >
          <ChevronRight className="w-5 h-5 text-ink/60" />
        </button>
      </div>

      {/* Hours summary */}
      <div className="flex items-center gap-4 mb-4 bg-white border border-border rounded-xl px-4 py-3">
        <div className="flex-1 text-center">
          <p className="font-mono text-sm font-medium text-partner-a">
            {aHours.toFixed(1)} hrs
          </p>
          <p className="text-xs text-ink/50 font-sans">{displayName("a")}</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex-1 text-center">
          <p className="font-mono text-sm font-medium text-partner-b">
            {bHours.toFixed(1)} hrs
          </p>
          <p className="text-xs text-ink/50 font-sans">{displayName("b")}</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex-1 text-center">
          <p className="font-mono text-sm font-medium text-shared-gold">
            {(aHours + bHours).toFixed(1)} hrs
          </p>
          <p className="text-xs text-ink/50 font-sans">Combined</p>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="space-y-2 mb-6">
        {weekDays.map((day) => {
          const dateStr = toDateString(day);
          const dayShifts = shifts.filter((s) => s.day === dateStr);
          const aShift = dayShifts.find((s) => s.person === "a");
          const bShift = dayShifts.find((s) => s.person === "b");
          const bothFree = !aShift && !bShift;

          return (
            <div key={dateStr} className="flex items-center gap-2">
              <div className="w-12 flex-shrink-0">
                <p className="text-xs font-sans font-semibold text-ink/50 uppercase">
                  {format(day, "EEE")}
                </p>
                <p className="text-xs font-mono text-ink/30">{format(day, "d")}</p>
              </div>

              {bothFree ? (
                <div className="flex-1 bg-partner-a/8 border border-partner-a/20 rounded-xl px-3 py-2 text-center">
                  <span className="text-xs font-sans text-partner-a font-medium">
                    ✨ Both free this evening
                  </span>
                </div>
              ) : (
                <div className="flex-1 flex gap-2">
                  {aShift ? (
                    <ShiftPill shift={aShift} role="a" name={displayName("a")} />
                  ) : (
                    <div className="flex-1" />
                  )}
                  {bShift ? (
                    <ShiftPill shift={bShift} role="b" name={displayName("b")} />
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
              )}

              <button
                onClick={() => setShowAddShift(true)}
                className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-ink/30 hover:text-partner-a hover:border-partner-a transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
                aria-label={`Add shift for ${format(day, "EEEE")}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Nudges & Reminders */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl font-light text-ink">Nudges & Reminders</h2>
          <button
            onClick={() => setShowAddReminder(true)}
            className="text-xs font-sans text-partner-a font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a rounded"
          >
            + Add
          </button>
        </div>
        {reminders.length === 0 ? (
          <p className="text-sm text-ink/40 font-sans text-center py-3">
            No pending reminders.
          </p>
        ) : (
          <div className="space-y-2">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-medium text-ink truncate">
                    📌 {r.text}
                  </p>
                  <p className="text-xs text-ink/50 font-sans">
                    for {displayName(r.assignedTo)} · from {displayName(r.assignedBy)}
                    {r.dueDate && ` · due ${format(new Date(r.dueDate + "T00:00:00"), "MMM d")}`}
                  </p>
                </div>
                {r.googleEventId && (
                  <span className="text-xs text-partner-a font-sans" title="Synced to Google Calendar">
                    📅
                  </span>
                )}
                <button
                  onClick={() => markReminderDone(r.id)}
                  className="flex-shrink-0 text-xs font-sans font-medium text-partner-a border border-partner-a/30 rounded-lg px-3 py-1.5 hover:bg-partner-a/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
                >
                  Done ✓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Whose Turn — Chores */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl font-light text-ink">Whose Turn</h2>
          <button
            onClick={() => setShowAddChore(true)}
            className="text-xs font-sans text-partner-a font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a rounded"
          >
            + Add chore
          </button>
        </div>
        {chores.length === 0 ? (
          <p className="text-sm text-ink/40 font-sans text-center py-3">
            No chores yet. Add one!
          </p>
        ) : (
          <div className="space-y-2">
            {chores.map((chore) => (
              <div
                key={chore.id}
                className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <p className="flex-1 text-sm font-sans font-medium text-ink">
                  {chore.name}
                </p>
                <span
                  className={cn(
                    "text-xs font-sans font-medium px-2.5 py-1 rounded-full",
                    chore.turn === "a"
                      ? "bg-partner-a/10 text-partner-a"
                      : "bg-partner-b/10 text-partner-b"
                  )}
                >
                  {displayName(chore.turn)}&apos;s turn
                </span>
                <button
                  onClick={() => markChoreDone(chore)}
                  className={cn(
                    "flex-shrink-0 text-xs font-sans font-medium border rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2",
                    chore.turn === "a"
                      ? "text-partner-a border-partner-a/30 hover:bg-partner-a/5 focus-visible:ring-partner-a"
                      : "text-partner-b border-partner-b/30 hover:bg-partner-b/5 focus-visible:ring-partner-b"
                  )}
                >
                  Done ✓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddShift && (
        <AddShiftModal onClose={() => setShowAddShift(false)} spaceId={spaceId!} defaultDay={weekOf} />
      )}
      {showAddReminder && (
        <AddReminderModal onClose={() => setShowAddReminder(false)} spaceId={spaceId!} />
      )}
      {showAddChore && (
        <AddChoreModal onClose={() => setShowAddChore(false)} spaceId={spaceId!} />
      )}
    </div>
  );
}

function ShiftPill({ shift, role, name }: { shift: Shift; role: Role; name: string }) {
  const color = role === "a" ? "bg-partner-a" : "bg-partner-b";
  return (
    <div className={cn("flex-1 rounded-xl px-3 py-2 flex items-center gap-2", color)}>
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        <span className="text-xs text-white font-sans font-semibold">
          {name.charAt(0)}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-white font-sans font-medium leading-tight">
          {shift.start}–{shift.end}
        </p>
        {shift.wfh && (
          <p className="text-xs text-white/70 font-sans leading-tight">WFH 🏠</p>
        )}
      </div>
    </div>
  );
}
