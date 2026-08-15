"use client";

import { useEffect, useState } from "react";
import {
  collection, query, onSnapshot, orderBy, doc, updateDoc, addDoc
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider, BraidProgressBar } from "@/components/Braid";
import { cn, formatCurrency } from "@/lib/utils";
import { Goal, WishlistItem } from "@/lib/types";
import ContributeModal from "@/components/modals/ContributeModal";
import AddGoalModal from "@/components/modals/AddGoalModal";
import AddWishlistModal from "@/components/modals/AddWishlistModal";
import GoalCelebration from "@/components/GoalCelebration";
import RevealGiftsModal from "@/components/modals/RevealGiftsModal";

export default function GoalsPage() {
  const { spaceId, role, displayName } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [contributingTo, setContributingTo] = useState<Goal | null>(null);
  const [revealingGiftsFor, setRevealingGiftsFor] = useState<Goal | null>(null);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddWishlist, setShowAddWishlist] = useState(false);
  const [celebratingGoal, setCelebratingGoal] = useState<Goal | null>(null);

  useEffect(() => {
    if (!spaceId) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(
      query(collection(db, "spaces", spaceId, "goals"), orderBy("createdAt", "desc")),
      (snap) => {
        const gs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal));
        setGoals(gs);

        // Check for newly completed goals (trigger celebration once)
        gs.forEach((g) => {
          if (g.current >= g.target && !g.celebrated) {
            setCelebratingGoal(g);
            // Mark as celebrated immediately to prevent re-trigger
            updateDoc(doc(db, "spaces", spaceId!, "goals", g.id), { celebrated: true });
          }
        });
      }
    ));

    unsubs.push(onSnapshot(
      query(collection(db, "spaces", spaceId, "wishlist"), orderBy("createdAt", "desc")),
      (snap) => {
        setWishlist(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WishlistItem)));
      }
    ));

    return () => unsubs.forEach((u) => u());
  }, [spaceId]);

  const promoteToGoal = async (item: WishlistItem) => {
    if (!spaceId) return;
    // Add a new goal with the wishlist item's text
    const goalRef = await addDoc(collection(db, "spaces", spaceId, "goals"), {
      name: item.text,
      target: 0,
      current: 0,
      deadline: null,
      celebrated: false,
      contributions: { a: 0, b: 0 },
      gifts: [],
      createdAt: new Date().toISOString(),
    });
    // Mark wishlist item as promoted
    await updateDoc(doc(db, "spaces", spaceId, "wishlist", item.id), {
      promotedToGoalId: goalRef.id,
    });
  };

  const activeWishlist = wishlist.filter((w) => !w.promotedToGoalId);

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <header className="mb-1">
        <h1 className="font-display text-4xl font-light text-ink">Goals</h1>
      </header>
      <BraidDivider className="mb-5" />

      {/* Goals list */}
      <div className="space-y-4 mb-4">
        <AnimatePresence>
          {goals.map((goal) => {
            const progress = goal.target > 0 ? goal.current / goal.target : 0;
            const hasMystery = goal.gifts?.some((g) => !g.revealed);
            const isComplete = goal.current >= goal.target && goal.target > 0;

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display text-xl font-light text-ink">{goal.name}</h3>
                    {goal.deadline && (
                      <p className="text-xs text-ink/40 font-sans mt-0.5">
                        by {goal.deadline}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasMystery && (
                      <button
                        onClick={() => setRevealingGiftsFor(goal)}
                        className="text-xs bg-shared-gold/15 text-shared-gold border border-shared-gold/30 rounded-full px-2.5 py-1 font-sans font-medium hover:bg-shared-gold/25 transition-colors"
                      >
                        🎁 mystery gift waiting
                      </button>
                    )}
                    {isComplete && (
                      <span className="text-xs bg-partner-a/10 text-partner-a rounded-full px-2.5 py-1 font-sans font-medium">
                        ✓ Complete!
                      </span>
                    )}
                  </div>
                </div>

                {/* Braid progress bar */}
                <BraidProgressBar progress={progress} height={12} className="mb-2" />

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-xs text-ink/60">
                      {formatCurrency(goal.current)} / {formatCurrency(goal.target)}
                    </p>
                    <p className="font-mono text-xs text-ink/40 mt-0.5">
                      {displayName("a")}: {formatCurrency(goal.contributions?.a || 0)} ·{" "}
                      {displayName("b")}: {formatCurrency(goal.contributions?.b || 0)}
                    </p>
                  </div>
                  <span className="font-mono text-lg font-medium text-ink/60">
                    {Math.round(progress * 100)}%
                  </span>
                </div>

                <button
                  onClick={() => setContributingTo(goal)}
                  disabled={isComplete}
                  className="w-full py-2 rounded-lg border border-partner-a text-partner-a text-sm font-sans font-medium hover:bg-partner-a/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
                >
                  Contribute
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {goals.length === 0 && (
          <p className="text-center text-ink/40 font-sans text-sm py-6">
            No goals yet. Create your first one!
          </p>
        )}
      </div>

      {/* Add goal button */}
      <button
        onClick={() => setShowAddGoal(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-shared-gold/40 text-shared-gold font-sans font-medium text-sm hover:bg-shared-gold/5 transition-colors mb-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shared-gold"
      >
        + Add Goal
      </button>

      {/* Wishlist */}
      <h2 className="font-display text-2xl font-light text-ink mb-3">Wishlist</h2>
      <div className="space-y-2 mb-4">
        {activeWishlist.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <p className="flex-1 text-sm font-sans text-ink">{item.text}</p>
            <button
              onClick={() => promoteToGoal(item)}
              className="flex-shrink-0 text-xs font-sans text-partner-a font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a rounded"
            >
              Make it a Goal →
            </button>
          </div>
        ))}
        {activeWishlist.length === 0 && (
          <p className="text-sm text-ink/40 font-sans text-center py-2">
            Nothing on the wishlist yet.
          </p>
        )}
      </div>

      <button
        onClick={() => setShowAddWishlist(true)}
        className="text-sm font-sans text-shared-gold font-medium hover:underline mb-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shared-gold rounded"
      >
        + Add to wishlist
      </button>

      {/* Modals */}
      {contributingTo && (
        <ContributeModal
          goal={contributingTo}
          onClose={() => setContributingTo(null)}
          spaceId={spaceId!}
        />
      )}
      {revealingGiftsFor && (
        <RevealGiftsModal
          goal={revealingGiftsFor}
          onClose={() => setRevealingGiftsFor(null)}
          spaceId={spaceId!}
        />
      )}
      {showAddGoal && (
        <AddGoalModal onClose={() => setShowAddGoal(false)} spaceId={spaceId!} />
      )}
      {showAddWishlist && (
        <AddWishlistModal onClose={() => setShowAddWishlist(false)} spaceId={spaceId!} />
      )}
      {/* Goal celebration — full-screen moment, triggered once per goal */}
      {celebratingGoal && (
        <GoalCelebration
          goalName={celebratingGoal.name}
          onDone={() => setCelebratingGoal(null)}
        />
      )}
    </div>
  );
}
