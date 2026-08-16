"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
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
  
  const supabase = createClient();

  useEffect(() => {
    if (!spaceId) return;

    const fetchData = async () => {
      // Goals
      const { data: goalsData } = await supabase
        .from('goals')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false });
        
      if (goalsData) {
        const gs = goalsData.map(d => ({
          ...d,
          createdAt: d.created_at,
          contributions: d.contributions || { a: 0, b: 0 }
        })) as Goal[];
        setGoals(gs);

        // Check for newly completed goals (trigger celebration once)
        gs.forEach(async (g) => {
          if (g.current >= g.target && !g.celebrated) {
            setCelebratingGoal(g);
            // Mark as celebrated immediately to prevent re-trigger
            await supabase
              .from('goals')
              .update({ celebrated: true })
              .eq('id', g.id);
          }
        });
      }

      // Wishlist
      const { data: wishlistData } = await supabase
        .from('wishlist')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false });
        
      if (wishlistData) {
        setWishlist(wishlistData.map(d => ({
          ...d,
          createdAt: d.created_at,
          promotedToGoalId: d.promoted_to_goal_id
        })) as any);
      }
    };

    fetchData();

    const channel = supabase.channel('goals_page_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `space_id=eq.${spaceId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist', filter: `space_id=eq.${spaceId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, supabase]);

  const promoteToGoal = async (item: WishlistItem) => {
    if (!spaceId) return;
    
    // Add a new goal with the wishlist item's text
    const { data: goalData, error } = await supabase
      .from('goals')
      .insert({
        space_id: spaceId,
        name: item.text,
        target: 0,
        current: 0,
        deadline: null,
        celebrated: false,
        contributions: { a: 0, b: 0 },
        gifts: [],
      })
      .select()
      .single();
      
    if (error || !goalData) {
      console.error("Error creating goal:", error);
      return;
    }

    // Mark wishlist item as promoted
    await supabase
      .from('wishlist')
      .update({ promoted_to_goal_id: goalData.id })
      .eq('id', item.id);
  };

  const activeWishlist = wishlist.filter((w) => !w.promotedToGoalId);

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <header className="mb-1">
        <h1 className="font-display text-4xl font-light text-primary">Goals</h1>
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
                className="bg-surface rounded-[24px] p-5 border-t border-white/5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display text-2xl font-light text-primary">{goal.name}</h3>
                    {goal.deadline && (
                      <p className="text-[11px] uppercase tracking-wide text-muted font-sans mt-1">
                        by {goal.deadline}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasMystery && (
                      <button
                        onClick={() => setRevealingGiftsFor(goal)}
                        className="text-[10px] uppercase tracking-wider bg-shared-gold/15 text-shared-gold rounded-full px-2.5 py-1 font-sans font-bold hover:bg-shared-gold/25 transition-colors"
                      >
                        Gift Waiting
                      </button>
                    )}
                    {isComplete && (
                      <span className="text-[10px] uppercase tracking-wider bg-partner-a/15 text-partner-a rounded-full px-2.5 py-1 font-sans font-bold">
                        Complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Braid progress bar */}
                <BraidProgressBar progress={progress} height={16} className="mb-4" showLabel={false} />

                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="font-mono text-sm text-primary">
                      {formatCurrency(goal.current)} <span className="text-muted">/ {formatCurrency(goal.target)}</span>
                    </p>
                    <p className="font-mono text-[11px] text-muted mt-1 uppercase tracking-wide">
                      {displayName("a")}: {formatCurrency(goal.contributions?.a || 0)} ·{" "}
                      {displayName("b")}: {formatCurrency(goal.contributions?.b || 0)}
                    </p>
                  </div>
                  <span className="font-mono text-2xl font-light text-primary">
                    {Math.round(progress * 100)}%
                  </span>
                </div>

                <button
                  onClick={() => setContributingTo(goal)}
                  disabled={isComplete}
                  className="w-full py-3 rounded-full bg-surface-raised text-partner-a text-sm font-sans font-medium hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
                >
                  Contribute
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {goals.length === 0 && (
          <p className="text-center text-muted font-sans text-sm py-6">
            No goals yet. Create your first one!
          </p>
        )}
      </div>

      {/* Add goal button */}
      <button
        onClick={() => setShowAddGoal(true)}
        className="w-full py-4 rounded-2xl border-2 border-dashed border-shared-gold/30 text-shared-gold font-sans font-medium text-sm hover:bg-shared-gold/10 transition-colors mb-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shared-gold"
      >
        + Add Goal
      </button>

      {/* Wishlist */}
      <h2 className="font-display text-2xl font-light text-primary mb-3">Wishlist</h2>
      <div className="space-y-2 mb-4">
        {activeWishlist.map((item) => (
          <div
            key={item.id}
            className="bg-surface rounded-xl px-4 py-3 flex items-center gap-3 border-t border-white/5"
          >
            <p className="flex-1 text-sm font-sans font-medium text-primary">{item.text}</p>
            <button
              onClick={() => promoteToGoal(item)}
              className="flex-shrink-0 text-[11px] uppercase tracking-wide font-sans text-partner-a font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a rounded"
            >
              Make Goal →
            </button>
          </div>
        ))}
        {activeWishlist.length === 0 && (
          <p className="text-sm text-muted font-sans text-center py-2">
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
