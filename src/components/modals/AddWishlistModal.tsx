"use client";
import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";

export default function AddWishlistModal({ onClose, spaceId }: { onClose: () => void; spaceId: string }) {
  const { role } = useAuth();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "spaces", spaceId, "wishlist"), {
        text: text.trim(), promotedToGoalId: null, createdAt: new Date().toISOString(), createdBy: role,
      });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <Modal title="Add to Wishlist" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">What would you like one day?</label>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="e.g. Bali holiday 🌴" autoFocus
            className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans focus:outline-none focus:ring-2 focus:ring-shared-gold" />
        </div>
        <button onClick={handleSave} disabled={!text.trim() || saving}
          className="w-full py-3.5 bg-shared-gold text-background font-sans font-medium rounded-xl hover:bg-shared-gold/90 transition-colors disabled:opacity-40">
          {saving ? "Adding…" : "Add to wishlist"}
        </button>
      </div>
    </Modal>
  );
}
