import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { startOfWeek, differenceInCalendarWeeks, isMonday } from "date-fns";
import { Transaction, Role } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a YYYY-MM-DD string for a given Date (or today if omitted).
 */
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

/**
 * Returns the Monday of the week containing `date` as YYYY-MM-DD.
 * Used as a stable identifier for week-scoped data.
 */
export function getWeekOf(date: Date = new Date()): string {
  return toDateString(startOfWeek(date, { weekStartsOn: 1 }));
}

/**
 * Format a number as a currency string (£ prefix, 2 decimal places).
 */
export function formatCurrency(amount: number): string {
  return `£${Math.abs(amount).toFixed(2)}`;
}

/**
 * Compute hours between two HH:MM strings.
 */
export function computeHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, minutes / 60);
}

/**
 * Compute the balance between Partner A and Partner B from shared transactions.
 * Returns positive if A is owed money (B paid less than their fair share),
 * negative if B is owed money.
 *
 * Logic: Split every shared-payer transaction 50/50. Transactions paid by A
 * mean A put in full amount; B owes A half. Transactions paid by B: reverse.
 */
export function computeBalance(transactions: Transaction[]): number {
  let balance = 0; // Positive = B owes A

  for (const t of transactions) {
    if (t.type !== "expense") continue;

    if (t.payer === "a") {
      // A paid full; B owes half
      balance += t.amount / 2;
    } else if (t.payer === "b") {
      // B paid full; A owes half
      balance -= t.amount / 2;
    }
    // "shared" transactions already counted as split
  }

  return balance;
}

/**
 * Returns a human-readable balance string.
 */
export function formatBalance(
  balance: number,
  nameA: string,
  nameB: string
): { debtor: string; creditor: string; amount: string; settled: boolean } {
  const threshold = 0.01;
  if (Math.abs(balance) < threshold) {
    return { debtor: "", creditor: "", amount: "", settled: true };
  }

  if (balance > 0) {
    // B owes A
    return {
      debtor: nameB,
      creditor: nameA,
      amount: formatCurrency(balance),
      settled: false,
    };
  } else {
    // A owes B
    return {
      debtor: nameA,
      creditor: nameB,
      amount: formatCurrency(-balance),
      settled: false,
    };
  }
}

/**
 * Compute the current check-in streak — number of consecutive weeks with entries.
 * Weeks are identified by their Monday date string.
 */
export function computeStreak(weekOfs: string[]): number {
  if (!weekOfs || weekOfs.length === 0) return 0;

  // Sort descending (most recent first)
  const sorted = [...new Set(weekOfs)].sort().reverse();

  const thisWeek = getWeekOf();
  const lastWeek = getWeekOf(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  // Streak is 0 if most recent check-in is older than this or last week
  if (sorted[0] !== thisWeek && sorted[0] !== lastWeek) return 0;

  let streak = 0;
  let expected = sorted[0];

  for (const weekOf of sorted) {
    if (weekOf === expected) {
      streak++;
      // Move expected back one week
      const d = new Date(expected + "T00:00:00");
      d.setDate(d.getDate() - 7);
      expected = toDateString(d);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Returns a greeting based on the current hour.
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
