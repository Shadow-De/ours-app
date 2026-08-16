"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider, BraidProgressBar } from "@/components/Braid";
import { PartnerAvatar } from "@/components/PartnerAvatar";
import { cn, formatCurrency, getGreeting, getWeekOf, toDateString } from "@/lib/utils";
import { Transaction, Reminder, Goal, Shift } from "@/lib/types";
import { format, startOfWeek, addDays } from "date-fns";
import { Wallet, Clock, Bell, Star } from "lucide-react";
import AddTransactionModal from "@/components/modals/AddTransactionModal";
import AddShiftModal from "@/components/modals/AddShiftModal";
import AddReminderModal from "@/components/modals/AddReminderModal";
import AddComplimentModal from "@/components/modals/AddComplimentModal";
import NicknameModal from "@/components/modals/NicknameModal";

export default function HomePage() {
  const { user, userDoc, space, role, spaceId, displayName } = useAuth();
  const router = useRouter();
  const supabase = createClient();

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

  // Data fetch and subscriptions
  useEffect(() => {
    if (!spaceId) return;

    const weekOf = getWeekOf();

    const fetchData = async () => {
      // Transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('space_id', spaceId)
        .order('date', { ascending: false })
        .limit(50);
      if (txData) setTransactions(txData as any);

      // Reminders
      const { data: remData } = await supabase
        .from('reminders')
        .select('*')
        .eq('space_id', spaceId)
        .eq('assigned_to', role)
        .eq('done', false);
      if (remData) setReminders(remData as any);

      // Goals
      const { data: goalsData } = await supabase
        .from('goals')
        .select('*')
        .eq('space_id', spaceId)
        .limit(10);
      if (goalsData) setGoals(goalsData as any);

      // Shifts
      const { data: shiftsData } = await supabase
        .from('shifts')
        .select('*')
        .eq('space_id', spaceId)
        .eq('week_of', weekOf);
      if (shiftsData) setShifts(shiftsData as any);

      setLoading(false);
    };

    fetchData();

    // Set up real-time subscriptions
    const channel = supabase.channel('home_page_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `space_id=eq.${spaceId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders', filter: `space_id=eq.${spaceId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `space_id=eq.${spaceId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `space_id=eq.${spaceId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, role, supabase]);

  // Computed values
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => toDateString(addDays(weekStart, i)));

  const thisWeekTransactions = transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= weekStart;
  });
  const totalSpent = thisWeekTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const myShifts = shifts.filter((s) => s.person === role);
  const partnerRole = role === "a" ? "b" : role === "b" ? "a" : null;
  const myHours = myShifts.reduce((sum, s) => sum + Number(s.hours), 0);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-6 h-6 border-2 border-partner-a border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <header className="flex items-start justify-between mb-1">
        <h1 className="font-display text-4xl font-light text-primary tracking-tight">
          Us.
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <PartnerAvatar role={role!} initial={myInitial} size="sm" />
          <PartnerAvatar role={partnerRole!} initial={partnerInitial} size="sm" />
        </div>
      </header>

      <BraidDivider className="mb-4" />

      <p className="text-lg font-sans font-medium text-primary mb-4">
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
            <span className="text-sm font-sans font-medium text-primary">
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
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Stat Chips */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 aspect-[4/5] bg-surface rounded-[24px] p-4 flex flex-col justify-between border-t border-white/5">
          <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-partner-a">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <p className="font-mono text-xl font-semibold text-partner-a">
              {formatCurrency(totalSpent)}
            </p>
            <p className="text-xs text-muted font-sans mt-1">spent this week</p>
          </div>
        </div>
        <div className="flex-1 aspect-[4/5] bg-surface rounded-[24px] p-4 flex flex-col justify-between border-t border-white/5">
          <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-partner-b">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="font-mono text-xl font-semibold text-partner-b">
              {myHours.toFixed(1)}<span className="text-sm font-sans text-muted ml-1">hrs</span>
            </p>
            <p className="text-xs text-muted font-sans mt-1">your hours</p>
          </div>
        </div>
        {/* Third empty slot for proportion consistency */}
        <div className="flex-1 aspect-[4/5]" />
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
          <p className="text-sm font-sans text-muted">
            {format(new Date(nextFreeEvening + "T00:00:00"), "EEEE")} looks free — plan something?
          </p>
        </motion.div>
      )}

      {/* Quick-add grid */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <QuickAddButton
          label="Expense"
          color="text-partner-a"
          icon={Wallet}
          onClick={() => setShowExpense(true)}
        />
        <QuickAddButton
          label="Hours"
          color="text-partner-b"
          icon={Clock}
          onClick={() => setShowHours(true)}
        />
        <QuickAddButton
          label="Nudge"
          color="text-shared-gold"
          icon={Bell}
          onClick={() => setShowNudge(true)}
        />
        <QuickAddButton
          label="Win"
          color="text-primary"
          icon={Star}
          onClick={() => setShowLittleWin(true)}
        />
      </div>

      {/* Goals preview */}
      {topGoals.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-light text-primary mb-3">Goals</h2>
          <div className="space-y-3">
            {topGoals.map((goal) => {
              const progress = goal.target > 0 ? goal.current / goal.target : 0;
              const hasMystery = goal.gifts?.some((g) => !g.revealed);
              return (
                <div key={goal.id} className="bg-surface rounded-2xl p-4 flex flex-col gap-3 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans font-medium text-primary">{goal.name}</h3>
                    {hasMystery && (
                      <span className="text-[10px] uppercase tracking-wider bg-shared-gold/15 text-shared-gold rounded-full px-2 py-1 font-sans font-bold">
                        Gift Waiting
                      </span>
                    )}
                  </div>
                  <BraidProgressBar progress={progress} height={16} showLabel={true} />
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
          partnerRole={partnerRole!}
          partnerRealName={space?.partnerB?.realName ?? ""}
        />
      )}
    </div>
  );
}

function QuickAddButton({
  label,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  icon: any;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-surface rounded-[20px] aspect-square flex flex-col items-center justify-center gap-2 border-t border-white/5 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
    >
      <div className={cn("w-10 h-10 rounded-full bg-background flex items-center justify-center", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[11px] font-sans font-medium text-muted uppercase tracking-wide">{label}</span>
    </button>
  );
}

function ReminderBanner({
  reminder,
  fromName,
}: {
  reminder: Reminder;
  fromName: string;
}) {
  const [marking, setMarking] = useState(false);
  const supabase = createClient();

  const markDone = async () => {
    setMarking(true);
    try {
      await supabase.from("reminders").update({ done: true }).eq("id", reminder.id);
    } catch (e) {
      console.error(e);
    }
    setMarking(false);
  };

  return (
    <div className="bg-surface rounded-xl px-4 py-3 flex items-center justify-between gap-3 border-t border-white/5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-sans font-medium text-primary truncate">
          {reminder.text}
        </p>
        <p className="text-[11px] text-muted font-sans uppercase tracking-wide mt-1">
          from {fromName}
          {reminder.dueDate && ` · ${format(new Date(reminder.dueDate + "T00:00:00"), "MMM d")}`}
        </p>
      </div>
      <button
        onClick={markDone}
        disabled={marking}
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-partner-a/10 text-partner-a hover:bg-partner-a/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
        aria-label="Mark done"
      >
        {marking ? <span className="animate-spin">…</span> : "✓"}
      </button>
    </div>
  );
}
