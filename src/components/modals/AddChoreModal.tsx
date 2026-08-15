"use client";
import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";

export default function AddChoreModal({ onClose, spaceId }: { onClose: () => void; spaceId: string }) {
  const { role } = useAuth();
  const [name, setName] = useState("");
  const [turn, setTurn] = useState<"a" | "b">(role ?? "a");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "spaces", spaceId, "chores"), {
        name: name.trim(), turn, lastDoneBy: null, lastDoneAt: null,
      });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <Modal title="Add Chore" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-sans font-medium text-ink/70 mb-1.5">Chore name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Take out trash" autoFocus
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-ink font-sans focus:outline-none focus:ring-2 focus:ring-partner-a" />
        </div>
        <div>
          <label className="block text-sm font-sans font-medium text-ink/70 mb-1.5">Whose turn first?</label>
          <div className="grid grid-cols-2 gap-2">
            {(["a", "b"] as const).map((p) => (
              <button key={p} onClick={() => setTurn(p)}
                className={`py-2.5 rounded-xl text-sm font-sans font-medium transition-colors ${turn === p ? (p === "a" ? "bg-partner-a text-white" : "bg-partner-b text-white") : "bg-white border border-border text-ink/50"}`}>
                Partner {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleSave} disabled={!name.trim() || saving}
          className="w-full py-3.5 bg-partner-a text-white font-sans font-medium rounded-xl hover:bg-partner-a/90 transition-colors disabled:opacity-40">
          {saving ? "Adding…" : "Add chore"}
        </button>
      </div>
    </Modal>
  );
}
