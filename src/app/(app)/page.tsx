"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider, BraidProgressBar } from "@/components/Braid";
import { PartnerAvatar } from "@/components/PartnerAvatar";
import { cn, formatCurrency, getGreeting, getWeekOf, toDateString, computeBalance, formatBalance } from "@/lib/utils";
import { Transaction, Reminder, Goal, Shift } from "@/lib/types";
import { format, startOfWeek, addDays, isToday } from "date-fns";
import AddTransactionModal from "@/components/modals/AddTransactionModal";
import AddShiftModal from "@/components/modals/AddShiftModal";
import AddReminderModal from "@/components/modals/AddReminderModal";
import AddComplimentModal from "@/components/modals/AddComplimentModal";
import NicknameModal from "@/components/modals/NicknameModal";

export default function HomePage() {
  const { user, userDoc, space, role, spaceId, displayName } = useAuth();
  const router = useRouter();

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showExpense, setShowExpense] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [showLittleWin, setShowLittleWin] = useState(false);
  const [showNickname, setShowNickname] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!user && !loading) router.push("/onboarding");
    if (user && userDoc && !userDoc.spaceId) router.push("/onboarding");
    if (userDoc?.spaceId && space?.status === "awaiting_partner") router.push("/waiting");
  }, [user, userDoc, space, loading, router]);

  // Real-time data subscriptions
  useEffect(() => {
    if (!spaceId) return;

    const weekOf = getWeekOf();
    const unsubs: (() => void)[] = [];

    // Transactions this week
    const txQ = query(
      collection(db, "spaces", spaceId, "transactions"),
      orderBy("date", "desc"),
      limit(50)
    );
    unsubs.push(onSnapshot(txQ, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
      setLoading(false);
    }));

    // Pending reminders assigned to current user
    const remQ = query(
      collection(db, "spaces", spaceId, "reminders"),
      where("assignedTo", "==", role),
      where("done", "==", false)
    );
    unsubs.push(onSnapshot(remQ, (snap) => {
      setReminders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reminder)));
    }));

    // Goals
    const goalsQ = query(
      collection(db, "spaces", spaceId, "goals"),
      limit(10)
    );
    unsubs.push(onSnapshot(goalsQ, (snap) => {
      setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal)));
    }));

    // This week's shifts
    const shiftsQ = query(
      collection(db, "spaces", spaceId, "shifts"),
      where("weekOf", "==", weekOf)
    );
    unsubs.push(onSnapshot(shiftsQ, (snap) => {
      setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift)));
    }));

    return () => unsubs.forEach((u) => u());
  }, [spaceId, role]);

  // Computed values
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => toDateString(addDays(weekStart, i)));

  const thisWeekTransactions = transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= weekStart;
  });
  const totalSpent = thisWeekTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const myShifts = shifts.filter((s) => s.person === role);
  const partnerRole = role === "a" ? "b" : "a";
  const myHours = myShifts.reduce((sum, s) => sum + s.hours, 0);

  const freeEvenings = weekDays.filter((day) => {
    const hasMeShift = shifts.some((s) => s.person === role && s.day === day);
    const hasPartnerShift = shifts.some((s) => s.person === partnerRole && s.day === day);
    return !hasMeShift && !hasPartnerShift;
  });

  const nextFreeEvening = freeEvenings.find((d) => {
    const date = new Date(d + "T00:00:00");
    return date >= new Date();
  });

  // Nickname banner: show if partner B joined but nickname for them hasn't been set by A
  const showNicknameBanner =
    role === "a" &&
    space?.status === "active" &&
    space?.partnerB &&
    !space?.nicknames?.forB;

  const myName = role ? displayName(role) : "";
  const partnerName = partnerRole ? displayName(partnerRole) : "";

  const myInitial = (space?.partnerA?.realName || space?.partnerB?.realName || "?").charAt(0);
  const partnerInitial = (
    role === "a"
      ? space?.partnerB?.realName
      : space?.partnerA?.realName
  )?.charAt(0) ?? "?";

  const topGoals = goals.slice(0, 2);

  if (!user || !userDoc || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-spin w-6 h-6 border-2 border-partner-a border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <header className="flex items-start justify-between mb-1">
        <h1 className="font-display text-4xl font-light text-ink tracking-tight">
          Us.
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <PartnerAvatar role={role!} initial={myInitial} size="sm" />
          <PartnerAvatar role={partnerRole} initial={partnerInitial} size="sm" />
        </div>
      </header>

      <BraidDivider className="mb-4" />

      <p className="text-lg font-sans font-medium text-ink mb-4">
        {getGreeting()}, {myName} 👋
      </p>

      {/* Nickname banner */}
      <AnimatePresence>
        {showNicknameBanner && (
          <motion.button
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onClick={() => setShowNickname(true)}
            className="w-full text-left bg-shared-gold/15 border border-shared-gold/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-2"
          >
            <span className="text-lg">🎉</span>
            <span className="text-sm font-sans font-medium text-ink">
              {space?.partnerB?.realName} joined — give them a nickname
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Pending reminders for me */}
      <AnimatePresence>
        {reminders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 space-y-2"
          >
            {reminders.slice(0, 3).map((r) => (
              <ReminderBanner
                key={r.id}
                reminder={r}
                fromName={displayName(r.assignedBy)}
                spaceId={spaceId!}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="font-mono text-2xl font-medium text-ink">
            {formatCurrency(totalSpent)}
          </p>
          <p className="text-xs text-ink/50 font-sans mt-0.5">spent this week</p>
          <div className="w-full h-0.5 bg-partner-a/20 mt-3 rounded-full">
            <div className="h-0.5 bg-partner-a rounded-full" style={{ width: "60%" }} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="font-mono text-2xl font-medium text-ink">
            {myHours.toFixed(1)}<span className="text-base font-sans text-ink/50 ml-1">hrs</span>
          </p>
          <p className="text-xs text-ink/50 font-sans mt-0.5">your hours</p>
          <div className="w-full h-0.5 bg-partner-b/20 mt-3 rounded-full">
            <div className="h-0.5 bg-partner-b rounded-full" style={{ width: `${Math.min(100, (myHours / 40) * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Free evening callout */}
      {nextFreeEvening && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-partner-a/8 border border-partner-a/20 rounded-xl px-4 py-3.5 mb-4"
        >
          <p className="text-sm font-sans font-semibold text-partner-a mb-0.5">
            Free Evening ✨
          </p>
          <p className="text-sm font-sans text-ink/70">
            {format(new Date(nextFreeEvening + "T00:00:00"), "EEEE")} looks free — plan something?
          </p>
        </motion.div>
      )}

      {/* Quick-add grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <QuickAddButton
          label="Expense"
          color="bg-partner-a"
          onClick={() => setShowExpense(true)}
        />
        <QuickAddButton
          label="Hours"
          color="bg-partner-b"
          onClick={() => setShowHours(true)}
        />
        <QuickAddButton
          label="Nudge"
          color="bg-shared-gold"
          onClick={() => setShowNudge(true)}
        />
        <QuickAddButton
          label="Little Win"
          color="bg-muted"
          textColor="text-ink/70"
          onClick={() => setShowLittleWin(true)}
        />
      </div>

      {/* Goals preview */}
      {topGoals.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-light text-ink mb-3">Goals</h2>
          <div className="space-y-3">
            {topGoals.map((goal) => {
              const progress = goal.target > 0 ? goal.current / goal.target : 0;
              const hasMystery = goal.gifts?.some((g) => !g.revealed);
              return (
                <div key={goal.id} className="bg-white rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-sans font-semibold text-ink">{goal.name}</h3>
                    {hasMystery && (
                      <span className="text-xs bg-shared-gold/15 text-shared-gold border border-shared-gold/30 rounded-full px-2 py-0.5 font-sans font-medium">
                        🎁 mystery gift waiting
                      </span>
                    )}
                  </div>
                  <BraidProgressBar progress={progress} height={10} className="mb-2" />
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-ink/50">
                      {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                    </p>
                    <p className="font-mono text-xs text-ink/50">
                      {Math.round(progress * 100)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showExpense && (
        <AddTransactionModal onClose={() => setShowExpense(false)} spaceId={spaceId!} />
      )}
      {showHours && (
        <AddShiftModal onClose={() => setShowHours(false)} spaceId={spaceId!} />
      )}
      {showNudge && (
        <AddReminderModal onClose={() => setShowNudge(false)} spaceId={spaceId!} />
      )}
      {showLittleWin && (
        <AddComplimentModal onClose={() => setShowLittleWin(false)} spaceId={spaceId!} />
      )}
      {showNickname && (
        <NicknameModal
          onClose={() => setShowNickname(false)}
          spaceId={spaceId!}
          partnerRole={partnerRole}
          partnerRealName={space?.partnerB?.realName ?? ""}
        />
      )}
    </div>
  );
}

function QuickAddButton({
  label,
  color,
  textColor = "text-white",
  onClick,
}: {
  label: string;
  color: string;
  textColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl py-4 font-sans font-medium text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a",
        color,
        textColor
      )}
    >
      <span className="text-lg leading-none">＋</span>
      {label}
    </button>
  );
}

function ReminderBanner({
  reminder,
  fromName,
  spaceId,
}: {
  reminder: Reminder;
  fromName: string;
  spaceId: string;
}) {
  const [marking, setMarking] = useState(false);

  const markDone = async () => {
    setMarking(true);
    try {
      await updateDoc(doc(db, "spaces", spaceId, "reminders", reminder.id), {
        done: true,
      });
    } catch (e) {
      console.error(e);
    }
    setMarking(false);
  };

  return (
    <div className="bg-white border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-sans font-medium text-ink truncate">
          📌 {reminder.text}
        </p>
        <p className="text-xs text-ink/50 font-sans mt-0.5">
          from {fromName}
          {reminder.dueDate && ` · due ${format(new Date(reminder.dueDate + "T00:00:00"), "MMM d")}`}
        </p>
      </div>
      <button
        onClick={markDone}
        disabled={marking}
        className="flex-shrink-0 text-xs font-sans font-medium text-partner-a border border-partner-a/30 rounded-lg px-3 py-1.5 hover:bg-partner-a/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
      >
        {marking ? "…" : "Done ✓"}
      </button>
    </div>
  );
}
