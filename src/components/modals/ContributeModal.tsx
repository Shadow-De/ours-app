"use client";

import { useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { Goal } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface ContributeModalProps {
  goal: Goal;
  onClose: () => void;
  spaceId: string;
}

export default function ContributeModal({ goal, onClose, spaceId }: ContributeModalProps) {
  const { role } = useAuth();
  const [amount, setAmount] = useState("");
  const [isSurprise, setIsSurprise] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleContribute = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0 || !role) return;
    setSaving(true);

    try {
      if (isSurprise) {
        // Mystery gift: add to gifts array, amount counts toward total but attribution hidden
        const newGift = {
          id: Date.now().toString(),
          amount: value,
          from: role,
          revealed: false,
        };
        await updateDoc(doc(db, "spaces", spaceId, "goals", goal.id), {
          current: goal.current + value,
          gifts: [...(goal.gifts || []), newGift],
        });
      } else {
        // Regular contribution: update total and per-partner contributions
        await updateDoc(doc(db, "spaces", spaceId, "goals", goal.id), {
          current: goal.current + value,
          [`contributions.${role}`]: (goal.contributions?.[role] || 0) + value,
        });
      }
      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const newTotal = parseFloat(amount) > 0
    ? goal.current + parseFloat(amount)
    : goal.current;
  const newProgress = goal.target > 0 ? (newTotal / goal.target) * 100 : 0;

  return (
    <Modal title={`Contribute to "${goal.name}"`} onClose={onClose}>
      <div className="space-y-4">
        {/* Current progress summary */}
        <div className="bg-muted rounded-xl px-4 py-3">
          <p className="font-mono text-sm text-muted">
            {formatCurrency(goal.current)} raised of {formatCurrency(goal.target)}
          </p>
          <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-partner-a via-partner-b to-shared-gold transition-all"
              style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
            />
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-mono">£</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full pl-8 pr-4 py-3 bg-surface border-none rounded-xl font-mono text-primary text-lg focus:outline-none focus:ring-2 focus:ring-partner-a"
            />
          </div>
          {parseFloat(amount) > 0 && (
            <p className="text-xs font-mono text-muted mt-1.5">
              New total: {formatCurrency(newTotal)} ({Math.round(newProgress)}%)
            </p>
          )}
        </div>

        {/* Mystery gift checkbox */}
        <label className="flex items-start gap-3 cursor-pointer bg-shared-gold/5 border border-shared-gold/20 rounded-xl px-4 py-3">
          <div
            className={`w-5 h-5 rounded flex-shrink-0 border-2 transition-colors mt-0.5 flex items-center justify-center ${
              isSurprise
                ? "bg-shared-gold border-shared-gold"
                : "bg-surface border-none"
            }`}
            role="checkbox"
            aria-checked={isSurprise}
            tabIndex={0}
            onClick={() => setIsSurprise(!isSurprise)}
            onKeyDown={(e) => e.key === " " && setIsSurprise(!isSurprise)}
          >
            {isSurprise && (
              <svg className="w-3 h-3 text-background" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-sans font-medium text-primary">🎁 Keep it a surprise</p>
            <p className="text-xs text-muted font-sans mt-0.5">
              Amount counts toward the goal, but who contributed is hidden until revealed.
            </p>
          </div>
        </label>

        <button
          onClick={handleContribute}
          disabled={!amount || parseFloat(amount) <= 0 || saving}
          className="w-full py-3.5 bg-partner-a text-background font-sans font-medium rounded-xl hover:bg-partner-a/90 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
        >
          {saving ? "Saving…" : isSurprise ? "🎁 Add mystery contribution" : "Contribute"}
        </button>
      </div>
    </Modal>
  );
}
