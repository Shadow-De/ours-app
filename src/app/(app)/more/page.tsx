"use client";

import { useEffect, useState } from "react";
import {
  collection, query, onSnapshot, orderBy, doc, updateDoc, addDoc, setDoc
} from "firebase/firestore";
import { motion } from "framer-motion";
import { Flame, LogOut, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider } from "@/components/Braid";
import { cn, computeStreak, getWeekOf } from "@/lib/utils";
import { Compliment, CheckIn, Budget, DEFAULT_CATEGORIES } from "@/lib/types";
import AddComplimentModal from "@/components/modals/AddComplimentModal";
import CheckInModal from "@/components/modals/CheckInModal";
import NicknameModal from "@/components/modals/NicknameModal";
import BudgetModal from "@/components/modals/BudgetModal";

export default function MorePage() {
  const { spaceId, role, space, displayName, signOut, user, partnerRole } = useAuth();
  const [compliments, setCompliments] = useState<Compliment[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [showAddCompliment, setShowAddCompliment] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showNicknameFor, setShowNicknameFor] = useState<"a" | "b" | null>(null);
  const [showBudgets, setShowBudgets] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });

  useEffect(() => {
    if (!spaceId) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(collection(db, "spaces", spaceId, "compliments"), orderBy("createdAt", "desc")),
      (snap) => {
        setCompliments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Compliment)));
      }
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "spaces", spaceId, "checkins"), orderBy("weekOf", "desc")),
      (snap) => {
        setCheckins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CheckIn)));
      }
    ));

    unsubs.push(onSnapshot(collection(db, "spaces", spaceId, "budgets"), (snap) => {
      const b: Record<string, number> = {};
      snap.docs.forEach((d) => { b[d.id] = (d.data() as Budget).monthlyLimit; });
      setBudgets(b);
    }));

    return () => unsubs.forEach((u) => u());
  }, [spaceId]);

  // Fetch calendar connection status from user docs
  useEffect(() => {
    if (!space?.partnerA?.uid || !space?.partnerB?.uid) return;
    // This reads from users/{uid}.googleCalendarConnected
    const fetchStatus = async () => {
      const { getDoc, doc: firestoreDoc } = await import("firebase/firestore");
      const aSnap = await getDoc(firestoreDoc(db, "users", space.partnerA.uid));
      const bSnap = space.partnerB
        ? await getDoc(firestoreDoc(db, "users", space.partnerB.uid))
        : null;
      setCalendarStatus({
        a: aSnap.data()?.googleCalendarConnected ?? false,
        b: bSnap?.data()?.googleCalendarConnected ?? false,
      });
    };
    fetchStatus();
  }, [space]);

  const streak = computeStreak(checkins.map((c) => c.weekOf));
  const thisWeekOf = getWeekOf();
  const thisWeekCheckin = checkins.find((c) => c.weekOf === thisWeekOf);

  const handleSignOut = async () => {
    await signOut();
  };

  const connectCalendar = async () => {
    // Trigger Google OAuth to get refresh token
    const { signInWithPopup } = await import("firebase/auth");
    const { auth, googleProvider } = await import("@/lib/firebase");
    const result = await signInWithPopup(auth, googleProvider);

    if (result.user && role) {
      const idToken = await result.user.getIdToken();
      await fetch("/api/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: result.user.uid, connect: true }),
      });
      setCalendarStatus((prev) => ({ ...prev, [role]: true }));
    }
  };

  const myCalendarConnected = role ? calendarStatus[role] : false;
  const partnerCalendarConnected = partnerRole ? calendarStatus[partnerRole] : false;

  return (
    <div className="px-4 pt-6 pb-8">
      {/* Header */}
      <header className="mb-1">
        <h1 className="font-display text-4xl font-light text-primary">More</h1>
      </header>
      <BraidDivider className="mb-5" />

      {/* Little Wins / Compliments */}
      <div className="mb-8">
        <h2 className="font-display text-2xl font-light text-primary mb-4">Little Wins</h2>
        <div className="space-y-2 mb-4">
          {compliments.slice(0, 5).map((c) => (
            <div
              key={c.id}
              className="bg-surface border-t border-white/5 rounded-2xl px-5 py-4"
            >
              <p className="text-[15px] font-sans font-medium text-primary mb-2">💛 {c.text}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted font-sans">
                from {displayName(c.from)} ·{" "}
                {format(new Date(c.date), "MMM d")}
              </p>
            </div>
          ))}
          {compliments.length === 0 && (
            <p className="text-sm text-muted font-sans text-center py-4">
              Leave each other little wins to celebrate small moments.
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAddCompliment(true)}
          className="w-full py-4 rounded-full border-2 border-dashed border-shared-gold/30 text-shared-gold text-sm font-sans font-medium hover:bg-shared-gold/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shared-gold"
        >
          + Leave a little win
        </button>
      </div>

      {/* Weekly Check-In */}
      <div className="mb-8">
        <h2 className="font-display text-2xl font-light text-primary mb-4">Weekly Check-In</h2>
        <div className="bg-surface border-t border-white/5 rounded-[24px] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-sans font-medium text-primary">
              Week of {format(new Date(thisWeekOf + "T00:00:00"), "MMM d")}
            </p>
            <div className="flex items-center gap-1.5 bg-shared-gold/15 rounded-full px-3 py-1">
              <Flame className="w-3.5 h-3.5 text-shared-gold" />
              <span className="text-[10px] uppercase tracking-wider font-sans font-bold text-shared-gold">
                {streak} week streak
              </span>
            </div>
          </div>
          {thisWeekCheckin ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted font-sans mb-2">This week&apos;s note:</p>
              <p className="text-sm font-sans text-primary">{thisWeekCheckin.note}</p>
            </div>
          ) : (
            <button
              onClick={() => setShowCheckin(true)}
              className="w-full py-3 rounded-full bg-partner-a text-background text-sm font-sans font-medium hover:bg-partner-a/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
            >
              Write this week&apos;s check-in
            </button>
          )}
        </div>

        {/* Past check-ins */}
        {checkins.length > 1 && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] text-muted font-sans uppercase tracking-wider font-bold mb-2 ml-1">
              Past check-ins
            </p>
            {checkins.slice(1, 5).map((c) => (
              <div key={c.id} className="bg-surface border-t border-white/5 rounded-2xl px-5 py-4">
                <p className="text-[11px] uppercase tracking-wide text-muted font-sans mb-2">
                  Week of {format(new Date(c.weekOf + "T00:00:00"), "MMM d")} ·{" "}
                  {displayName(c.submittedBy)}
                </p>
                <p className="text-[15px] font-sans text-primary line-clamp-2">{c.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/5 my-8" />

      {/* Names & Nicknames */}
      <div className="mb-8">
        <h2 className="font-sans text-[13px] uppercase tracking-wider font-bold text-muted mb-3 ml-1">Names & Nicknames</h2>
        <div className="bg-surface rounded-2xl divide-y divide-white/5 border-t border-white/5">
          {(["a", "b"] as const).map((r) => {
            const realName = r === "a" ? space?.partnerA?.realName : space?.partnerB?.realName;
            const nick = r === "a" ? space?.nicknames?.forA : space?.nicknames?.forB;
            const dotColor = r === "a" ? "bg-partner-a" : "bg-partner-b";
            return (
              <div key={r} className="flex items-center gap-4 px-5 py-4">
                <div className={cn("w-3 h-3 rounded-full flex-shrink-0", dotColor)} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-sans text-primary font-medium truncate">
                    {realName ?? `Partner ${r.toUpperCase()}`}
                  </p>
                  {nick && (
                    <p className="text-[11px] uppercase tracking-wide text-muted font-sans mt-1">
                      nickname: {nick}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowNicknameFor(r)}
                  className="text-[11px] uppercase tracking-wide text-partner-a font-sans font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a rounded"
                >
                  {nick ? "Rename" : "Set Nickname"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Google Calendar */}
      <div className="mb-8">
        <h2 className="font-sans text-[13px] uppercase tracking-wider font-bold text-muted mb-3 ml-1">Google Calendar</h2>
        <div className="bg-surface rounded-2xl divide-y divide-white/5 border-t border-white/5">
          {(["a", "b"] as const).map((r) => {
            const isMe = r === role;
            const isConnected = r === "a" ? calendarStatus.a : calendarStatus.b;
            const realName = r === "a" ? space?.partnerA?.realName : space?.partnerB?.realName;
            const dotColor = r === "a" ? "text-partner-a" : "text-partner-b";

            return (
              <div key={r} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[15px] font-sans font-medium", dotColor)}>
                    {realName ?? `Partner ${r.toUpperCase()}`}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-muted font-sans mt-1">
                    {isConnected ? "✅ Connected" : "⚪ Not connected"}
                  </p>
                </div>
                {isMe && !isConnected && (
                  <button
                    onClick={connectCalendar}
                    className="text-[11px] uppercase tracking-wide font-sans text-partner-a font-bold border border-partner-a/30 rounded-full px-4 py-2 hover:bg-partner-a/10 transition-colors"
                  >
                    Connect
                  </button>
                )}
                {isMe && isConnected && (
                  <button className="text-[11px] uppercase tracking-wide font-sans text-muted hover:text-alert transition-colors font-bold">
                    Disconnect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Categories & Budgets */}
      <button
        onClick={() => setShowBudgets(true)}
        className="w-full bg-surface border-t border-white/5 rounded-2xl px-5 py-4 flex items-center justify-between mb-8 hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
      >
        <span className="text-[15px] font-sans font-medium text-primary">Categories & Budgets</span>
        <ChevronRight className="w-5 h-5 text-muted" />
      </button>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full py-3 text-sm font-sans font-medium text-alert/80 hover:text-alert transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alert rounded-xl"
      >
        Sign Out
      </button>

      {/* Modals */}
      {showAddCompliment && (
        <AddComplimentModal onClose={() => setShowAddCompliment(false)} spaceId={spaceId!} />
      )}
      {showCheckin && (
        <CheckInModal onClose={() => setShowCheckin(false)} spaceId={spaceId!} />
      )}
      {showNicknameFor && (
        <NicknameModal
          onClose={() => setShowNicknameFor(null)}
          spaceId={spaceId!}
          partnerRole={showNicknameFor}
          partnerRealName={
            showNicknameFor === "a"
              ? space?.partnerA?.realName ?? ""
              : space?.partnerB?.realName ?? ""
          }
        />
      )}
      {showBudgets && (
        <BudgetModal onClose={() => setShowBudgets(false)} spaceId={spaceId!} budgets={budgets} />
      )}
    </div>
  );
}
