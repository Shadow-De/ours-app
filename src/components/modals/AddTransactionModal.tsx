"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { DEFAULT_CATEGORIES } from "@/lib/types";
import { toDateString } from "@/lib/utils";

interface AddTransactionModalProps {
  onClose: () => void;
  spaceId: string;
}

export default function AddTransactionModal({ onClose, spaceId }: AddTransactionModalProps) {
  const { role } = useAuth();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [payer, setPayer] = useState<"a" | "b" | "shared">(role ?? "a");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toDateString(new Date()));
  const [recurring, setRecurring] = useState<"" | "monthly" | "weekly">("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    setSaving(true);
    try {
      await supabase
        .from('transactions')
        .insert({
          space_id: spaceId,
          amount: parseFloat(amount),
          category,
          type,
          payer,
          note: note.trim(),
          date,
          recurring: recurring || null,
          created_by: role,
        });
      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <Modal title="Add Transaction" onClose={onClose}>
      <div className="space-y-4">
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
        </div>

        {/* Type toggle */}
        <div className="flex gap-2">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-sans font-medium transition-colors ${
                type === t
                  ? t === "expense"
                    ? "bg-alert/10 text-alert border border-alert/30"
                    : "bg-partner-a/10 text-partner-a border border-partner-a/30"
                  : "bg-surface border-none text-muted"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans focus:outline-none focus:ring-2 focus:ring-partner-a"
          >
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Payer */}
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">
            Paid by
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["a", "b", "shared"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPayer(p)}
                className={`py-2.5 rounded-xl text-sm font-sans font-medium transition-colors ${
                  payer === p
                    ? p === "a"
                      ? "bg-partner-a text-background"
                      : p === "b"
                      ? "bg-partner-b text-background"
                      : "bg-shared-gold text-background"
                    : "bg-surface border-none text-muted"
                }`}
              >
                {p === "shared" ? "Shared" : p === "a" ? "Partner A" : "Partner B"}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">
            Note <span className="text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Tesco run"
            className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans focus:outline-none focus:ring-2 focus:ring-partner-a"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans focus:outline-none focus:ring-2 focus:ring-partner-a"
          />
        </div>

        {/* Recurring */}
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">
            Recurring
          </label>
          <select
            value={recurring}
            onChange={(e) => setRecurring(e.target.value as "" | "monthly" | "weekly")}
            className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans focus:outline-none focus:ring-2 focus:ring-partner-a"
          >
            <option value="">One-time</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={!amount || saving}
          className="w-full py-3.5 bg-partner-a text-background font-sans font-medium rounded-xl hover:bg-partner-a/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
        >
          {saving ? "Saving…" : "Save transaction"}
        </button>
      </div>
    </Modal>
  );
}
