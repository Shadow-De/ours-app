"use client";

import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { toDateString } from "@/lib/utils";

interface AddGoalModalProps {
  onClose: () => void;
  spaceId: string;
}

export default function AddGoalModal({ onClose, spaceId }: AddGoalModalProps) {
  const { role } = useAuth();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "spaces", spaceId, "goals"), {
        name: name.trim(),
        target: parseFloat(target) || 0,
        current: 0,
        deadline: deadline || null,
        celebrated: false,
        contributions: { a: 0, b: 0 },
        gifts: [],
        createdAt: new Date().toISOString(),
      });
      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <Modal title="New Goal" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-sans font-medium text-ink/70 mb-1.5">Goal name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Paris Trip" autoFocus
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-ink font-sans focus:outline-none focus:ring-2 focus:ring-partner-a" />
        </div>
        <div>
          <label className="block text-sm font-sans font-medium text-ink/70 mb-1.5">Target amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 font-mono">£</span>
            <input type="number" value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder="0.00" className="w-full pl-8 pr-4 py-3 bg-white border border-border rounded-xl font-mono text-ink focus:outline-none focus:ring-2 focus:ring-partner-a" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-sans font-medium text-ink/70 mb-1.5">
            Deadline <span className="text-ink/30">(optional)</span>
          </label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            min={toDateString(new Date())}
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-ink font-sans focus:outline-none focus:ring-2 focus:ring-partner-a" />
        </div>
        <button onClick={handleSave} disabled={!name.trim() || saving}
          className="w-full py-3.5 bg-partner-a text-white font-sans font-medium rounded-xl hover:bg-partner-a/90 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a">
          {saving ? "Creating…" : "Create goal"}
        </button>
      </div>
    </Modal>
  );
}
