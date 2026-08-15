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
        <h1 className="font-display text-4xl font-light text-primary">Week</h1>
      </header>
      <BraidDivider className="mb-4" />

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-5 h-5 text-muted" />
        </button>
        <span className="font-sans font-semibold text-primary">
          {format(weekStart, "MMM d")}–{format(weekEnd, "d")}
        </span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
          aria-label="Next week"
        >
          <ChevronRight className="w-5 h-5 text-muted" />
        </button>
      </div>

      {/* Hours summary */}
      <div className="flex items-center gap-4 mb-6 bg-surface rounded-[24px] px-4 py-4 border-t border-white/5">
        <div className="flex-1 text-center">
          <p className="font-mono text-sm font-medium text-partner-a">
            {aHours.toFixed(1)} hrs
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted font-sans mt-1">{displayName("a")}</p>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="flex-1 text-center">
          <p className="font-mono text-sm font-medium text-partner-b">
            {bHours.toFixed(1)} hrs
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted font-sans mt-1">{displayName("b")}</p>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="flex-1 text-center">
          <p className="font-mono text-sm font-medium text-shared-gold">
            {(aHours + bHours).toFixed(1)} hrs
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted font-sans mt-1">Combined</p>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="space-y-2 mb-8">
        {weekDays.map((day) => {
          const dateStr = toDateString(day);
          const dayShifts = shifts.filter((s) => s.day === dateStr);
          const aShift = dayShifts.find((s) => s.person === "a");
          const bShift = dayShifts.find((s) => s.person === "b");
          const bothFree = !aShift && !bShift;

          return (
            <div key={dateStr} className="flex items-center gap-3">
              <div className="w-10 flex-shrink-0 text-center">
                <p className="text-[10px] font-sans font-bold text-muted uppercase tracking-wider">
                  {format(day, "EEE")}
                </p>
                <p className="text-sm font-mono text-primary">{format(day, "d")}</p>
              </div>

              {bothFree ? (
                <div className="flex-1 bg-surface-raised rounded-2xl px-4 py-3 text-center">
                  <span className="text-[11px] uppercase tracking-wide font-sans text-partner-a font-medium">
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
                className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-muted hover:text-partner-a transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
                aria-label={`Add shift for ${format(day, "EEEE")}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Nudges & Reminders */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl font-light text-primary">Nudges & Reminders</h2>
          <button
            onClick={() => setShowAddReminder(true)}
            className="text-xs font-sans text-partner-a font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a rounded"
          >
            + Add
          </button>
        </div>
        {reminders.length === 0 ? (
          <p className="text-sm text-muted font-sans text-center py-3">
            No pending reminders.
          </p>
        ) : (
          <div className="space-y-2">
            {reminders.map((r) => (
              <div
                key={r.id}
                className="bg-surface rounded-xl px-4 py-3 flex items-center gap-3 border-t border-white/5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-medium text-primary truncate">
                    {r.text}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-muted font-sans mt-1">
                    for {displayName(r.assignedTo)} · from {displayName(r.assignedBy)}
                    {r.dueDate && ` · ${format(new Date(r.dueDate + "T00:00:00"), "MMM d")}`}
                  </p>
                </div>
                {r.googleEventId && (
                  <span className="text-xs text-partner-a font-sans" title="Synced to Google Calendar">
                    📅
                  </span>
                )}
                <button
                  onClick={() => markReminderDone(r.id)}
                  className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-partner-a/10 text-partner-a hover:bg-partner-a/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
                >
                  ✓
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Whose Turn — Chores */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl font-light text-primary">Whose Turn</h2>
          <button
            onClick={() => setShowAddChore(true)}
            className="text-xs font-sans text-partner-a font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a rounded"
          >
            + Add chore
          </button>
        </div>
        {chores.length === 0 ? (
          <p className="text-sm text-muted font-sans text-center py-3">
            No chores yet. Add one!
          </p>
        ) : (
          <div className="space-y-2">
            {chores.map((chore) => (
              <div
                key={chore.id}
                className="bg-surface rounded-xl px-4 py-3 flex items-center gap-3 border-t border-white/5"
              >
                <p className="flex-1 text-sm font-sans font-medium text-primary">
                  {chore.name}
                </p>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-sans font-bold px-2 py-1 rounded-full",
                    chore.turn === "a"
                      ? "bg-partner-a/15 text-partner-a"
                      : "bg-partner-b/15 text-partner-b"
                  )}
                >
                  {displayName(chore.turn)}
                </span>
                <button
                  onClick={() => markChoreDone(chore)}
                  className={cn(
                    "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2",
                    chore.turn === "a"
                      ? "bg-partner-a/10 text-partner-a hover:bg-partner-a/20 focus-visible:ring-partner-a"
                      : "bg-partner-b/10 text-partner-b hover:bg-partner-b/20 focus-visible:ring-partner-b"
                  )}
                >
                  ✓
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
  const color = role === "a" ? "bg-partner-a text-background" : "bg-partner-b text-background";
  return (
    <div className={cn("flex-1 rounded-[16px] px-3 py-2 flex flex-col justify-center", color)}>
      <div className="min-w-0">
        <p className="text-[13px] font-sans font-semibold leading-tight tracking-tight truncate">
          {shift.start}–{shift.end}
        </p>
        {shift.wfh && (
          <p className="text-[10px] uppercase tracking-wider font-sans font-bold leading-tight opacity-70 mt-0.5">WFH</p>
        )}
      </div>
    </div>
  );
}
