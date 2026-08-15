"use client";

import { useEffect, useState } from "react";
import {
  collection, query, onSnapshot, orderBy, where, limit
} from "firebase/firestore";
import { motion } from "framer-motion";
import { Plus, ChevronDown, TrendingUp } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider } from "@/components/Braid";
import {
  cn, formatCurrency, computeBalance, formatBalance,
  getWeekOf, toDateString
} from "@/lib/utils";
import { Transaction, Budget, DEFAULT_CATEGORIES, NetWorthEntry } from "@/lib/types";
import AddTransactionModal from "@/components/modals/AddTransactionModal";
import { format, startOfMonth } from "date-fns";

export default function MoneyPage() {
  const { spaceId, role, displayName } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [netWorth, setNetWorth] = useState<NetWorthEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPayer, setFilterPayer] = useState<string>("all");

  useEffect(() => {
    if (!spaceId) return;
    const unsubs: (() => void)[] = [];

    // All transactions, recent first
    const txQ = query(
      collection(db, "spaces", spaceId, "transactions"),
      orderBy("date", "desc"),
      limit(100)
    );
    unsubs.push(onSnapshot(txQ, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
    }));

    // Budgets
    const budgetsQ = collection(db, "spaces", spaceId, "budgets");
    unsubs.push(onSnapshot(budgetsQ, (snap) => {
      const b: Record<string, number> = {};
      snap.docs.forEach((d) => { b[d.id] = (d.data() as Budget).monthlyLimit; });
      setBudgets(b);
    }));

    return () => unsubs.forEach((u) => u());
  }, [spaceId]);

  // Compute this month's spending per category
  const thisMonth = format(startOfMonth(new Date()), "yyyy-MM");
  const monthlyTransactions = transactions.filter((t) =>
    t.type === "expense" && t.date.startsWith(thisMonth)
  );

  const spendingByCategory: Record<string, number> = {};
  monthlyTransactions.forEach((t) => {
    spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + t.amount;
  });

  // Balance computation — from shared-payer transactions only
  const sharedTransactions = transactions.filter((t) => t.payer === "shared" || t.payer === "a" || t.payer === "b");
  const balance = computeBalance(transactions);
  const nameA = displayName("a");
  const nameB = displayName("b");
  const { debtor, creditor, amount, settled } = formatBalance(balance, nameA, nameB);

  // Filtered transaction list
  const filtered = transactions.filter((t) => {
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    if (filterPayer !== "all" && t.payer !== filterPayer) return false;
    return true;
  });

  const categories = Object.keys(spendingByCategory).length > 0
    ? Object.keys(spendingByCategory)
    : DEFAULT_CATEGORIES.slice(0, 5);

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <header className="mb-1">
        <h1 className="font-display text-4xl font-light text-ink">Money</h1>
      </header>
      <BraidDivider className="mb-5" />

      {/* Balance banner */}
      <div
        className={cn(
          "rounded-xl border p-4 mb-5",
          settled
            ? "bg-partner-a/5 border-partner-a/20"
            : balance > 0
            ? "bg-partner-b/5 border-partner-b/20"
            : "bg-partner-a/5 border-partner-a/20"
        )}
      >
        <p className="text-xs text-ink/50 font-sans uppercase tracking-wide font-medium mb-1">
          Balance
        </p>
        {settled ? (
          <p className="font-mono text-lg font-medium text-partner-a">
            ✓ All settled up
          </p>
        ) : (
          <p className="font-mono text-lg font-medium text-ink">
            <span className={cn(balance > 0 ? "text-partner-b" : "text-partner-a")}>
              {debtor}
            </span>{" "}
            owes{" "}
            <span className={cn(balance > 0 ? "text-partner-a" : "text-partner-b")}>
              {creditor}
            </span>{" "}
            <span className="font-mono">{amount}</span>
          </p>
        )}
        <p className="text-xs text-ink/40 font-sans mt-1">
          Computed from shared transactions, split 50/50
        </p>
      </div>

      {/* Budgets */}
      <h2 className="font-display text-2xl font-light text-ink mb-3">Budgets</h2>
      <div className="space-y-3 mb-6">
        {DEFAULT_CATEGORIES.filter((c) => budgets[c] !== undefined || spendingByCategory[c] !== undefined).map((cat) => {
          const spent = spendingByCategory[cat] || 0;
          const limit = budgets[cat] || 0;
          const overBudget = limit > 0 && spent > limit;
          const progress = limit > 0 ? Math.min(1, spent / limit) : 0;

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-sans text-ink">{cat}</span>
                <div className="flex items-center gap-2">
                  {overBudget && (
                    <span className="text-xs bg-alert/10 text-alert border border-alert/20 rounded-full px-2 py-0.5 font-sans font-medium">
                      OVER
                    </span>
                  )}
                  <span className="font-mono text-xs text-ink/60">
                    {formatCurrency(spent)}{limit > 0 ? `/${formatCurrency(limit)}` : ""}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", overBudget ? "bg-alert" : "bg-partner-a")}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          );
        })}
        {Object.keys(budgets).length === 0 && Object.keys(spendingByCategory).length === 0 && (
          <p className="text-sm text-ink/40 font-sans text-center py-4">
            No budgets set yet. Add them in More → Categories & Budgets.
          </p>
        )}
      </div>

      {/* Transaction filters */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-display text-2xl font-light text-ink flex-1">Transactions</h2>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-xs font-sans border border-border rounded-lg px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-1 focus:ring-partner-a"
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterPayer}
          onChange={(e) => setFilterPayer(e.target.value)}
          className="text-xs font-sans border border-border rounded-lg px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-1 focus:ring-partner-a"
          aria-label="Filter by payer"
        >
          <option value="all">All payers</option>
          <option value="a">{nameA}</option>
          <option value="b">{nameB}</option>
          <option value="shared">Shared</option>
        </select>
      </div>

      {/* Transaction list */}
      <div className="space-y-2 pb-8">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-ink/40 font-sans text-sm">
            No transactions yet. Add one with +
          </div>
        ) : (
          filtered.map((t) => {
            const payerRole = t.payer === "a" ? "a" : t.payer === "b" ? "b" : "shared";
            const dotColor =
              payerRole === "a"
                ? "bg-partner-a"
                : payerRole === "b"
                ? "bg-partner-b"
                : "bg-shared-gold";

            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-border px-4 py-3 flex items-center gap-3"
              >
                <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", dotColor)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-medium text-ink truncate">
                    {t.category}
                  </p>
                  {t.note && (
                    <p className="text-xs text-ink/50 font-sans truncate">{t.note}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn(
                    "font-mono text-sm font-medium",
                    t.type === "expense" ? "text-ink" : "text-partner-a"
                  )}>
                    {t.type === "expense" ? "-" : "+"}{formatCurrency(t.amount)}
                  </p>
                  <p className="text-xs text-ink/40 font-sans">
                    {t.payer === "shared" ? "Shared" : displayName(t.payer as "a" | "b")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-partner-a text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-partner-a/90 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a focus-visible:ring-offset-2 z-40"
        aria-label="Add transaction"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showAdd && (
        <AddTransactionModal onClose={() => setShowAdd(false)} spaceId={spaceId!} />
      )}
    </div>
  );
}
