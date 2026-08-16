"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { Goal } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface RevealGiftsModalProps {
  goal: Goal;
  onClose: () => void;
  spaceId: string;
}

export default function RevealGiftsModal({ goal, onClose, spaceId }: RevealGiftsModalProps) {
  const { displayName } = useAuth();
  const [revealing, setRevealing] = useState(false);
  const supabase = createClient();

  const hiddenGifts = goal.gifts?.filter((g) => !g.revealed) ?? [];

  const revealAll = async () => {
    setRevealing(true);
    try {
      const updatedGifts = (goal.gifts || []).map((g) => ({ ...g, revealed: true }));
      await supabase
        .from('goals')
        .update({ gifts: updatedGifts })
        .eq('id', goal.id);
      onClose();
    } catch (e) {
      console.error(e);
    }
    setRevealing(false);
  };

  return (
    <Modal title="Mystery Gifts 🎁" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm font-sans text-muted">
          There {hiddenGifts.length === 1 ? "is" : "are"} {hiddenGifts.length} hidden{" "}
          {hiddenGifts.length === 1 ? "contribution" : "contributions"} waiting to be revealed
          for &quot;{goal.name}&quot;.
        </p>

        <div className="bg-shared-gold/5 border border-shared-gold/20 rounded-xl p-4 text-center">
          <div className="text-5xl mb-3">🎁</div>
          <p className="font-mono text-lg font-medium text-primary">
            {formatCurrency(hiddenGifts.reduce((sum, g) => sum + g.amount, 0))}
          </p>
          <p className="text-xs text-muted font-sans mt-1">
            hidden across {hiddenGifts.length} contribution{hiddenGifts.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          onClick={revealAll}
          disabled={revealing}
          className="w-full py-3.5 bg-shared-gold text-background font-sans font-medium rounded-xl hover:bg-shared-gold/90 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shared-gold"
        >
          {revealing ? "Revealing…" : "✨ Reveal all gifts"}
        </button>

        <p className="text-center text-xs text-muted font-sans">
          Once revealed, the contributor&apos;s name will be shown.
        </p>
      </div>
    </Modal>
  );
}
