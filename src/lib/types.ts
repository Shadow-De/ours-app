// Firestore data model types — Section 7 of spec
// Field names match spec exactly; do not rename without updating security rules

export type Role = "a" | "b";
export type SpaceStatus = "awaiting_partner" | "active";

// spaces/{spaceId}
export interface Space {
  status: SpaceStatus;
  partnerA: {
    uid: string;
    realName: string;
    colorHex: "#2F6E62";
  };
  partnerB: {
    uid: string;
    realName: string;
    colorHex: "#5B5296";
  } | null;
  nicknames: {
    forA: string;  // nickname FOR Partner A (set by Partner B)
    forB: string;  // nickname FOR Partner B (set by Partner A)
  };
  createdAt: string; // ISO timestamp
}

// users/{uid}  — server-only readable fields
// encryptedRefreshToken is NEVER returned to client via any API route
export interface UserDoc {
  spaceId: string;
  role: Role;
  googleCalendarConnected: boolean;
  // encryptedRefreshToken: stored server-side, never sent to client
}

// spaces/{spaceId}/transactions/{id}
export interface Transaction {
  id: string;
  amount: number;
  category: string;
  type: "expense" | "income";
  payer: "a" | "b" | "shared";
  note: string;
  date: string; // ISO date string YYYY-MM-DD
  recurring?: "monthly" | "weekly" | null;
  createdAt: string;
  createdBy: Role;
}

// spaces/{spaceId}/budgets/{category}
export interface Budget {
  monthlyLimit: number;
  category: string;
}

// spaces/{spaceId}/goals/{id}
export interface Gift {
  id: string;
  amount: number;
  from: Role;
  revealed: boolean;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string | null;
  celebrated: boolean;
  contributions: { a: number; b: number };
  gifts: Gift[];
  createdAt: string;
}

// spaces/{spaceId}/wishlist/{id}
export interface WishlistItem {
  id: string;
  text: string;
  promotedToGoalId: string | null;
  createdAt: string;
  createdBy: Role;
}

// spaces/{spaceId}/shifts/{id}
export interface Shift {
  id: string;
  person: Role;
  day: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string;   // HH:MM
  wfh: boolean;
  hours: number;
  weekOf: string; // Monday of that week YYYY-MM-DD
  assignedBy: Role;
  googleEventId: string | null;
  createdAt: string;
}

// spaces/{spaceId}/reminders/{id}
export interface Reminder {
  id: string;
  text: string;
  assignedTo: Role;
  assignedBy: Role;
  dueDate: string | null; // YYYY-MM-DD
  done: boolean;
  googleEventId: string | null;
  createdAt: string;
}

// spaces/{spaceId}/chores/{id}
export interface Chore {
  id: string;
  name: string;
  turn: Role;
  lastDoneBy: Role | null;
  lastDoneAt: string | null; // ISO timestamp
}

// spaces/{spaceId}/compliments/{id}
export interface Compliment {
  id: string;
  text: string;
  from: Role;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

// spaces/{spaceId}/checkins/{id}
export interface CheckIn {
  id: string;
  weekOf: string; // Monday of week YYYY-MM-DD
  note: string;
  submittedBy: Role;
  createdAt: string;
}

// spaces/{spaceId}/networth/{id}  (snapshots for trend)
export interface NetWorthEntry {
  id: string;
  accounts: Array<{ name: string; balance: number }>;
  debts: Array<{ name: string; balance: number }>;
  total: number;
  snapshotDate: string; // YYYY-MM-DD
}

// Default categories per spec
export const DEFAULT_CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Dining",
  "Transport",
  "Fun",
  "Health",
  "Savings",
  "Other",
] as const;
