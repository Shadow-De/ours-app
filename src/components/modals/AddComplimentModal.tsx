"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { toDateString } from "@/lib/utils";

export default function AddComplimentModal({ onClose, spaceId }: { onClose: () => void; spaceId: string }) {
  const { role } = useAuth();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await supabase
        .from('compliments')
        .insert({
          space_id: spaceId,
          text: text.trim(),
          from_role: role,
          date: toDateString(new Date()),
        });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <Modal title="Leave a Little Win 💛" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">What do you appreciate?</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. You handled that call so well today 💛" autoFocus rows={4}
            className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans resize-none focus:outline-none focus:ring-2 focus:ring-shared-gold" />
        </div>
        <button onClick={handleSave} disabled={!text.trim() || saving}
          className="w-full py-3.5 bg-shared-gold text-background font-sans font-medium rounded-xl hover:bg-shared-gold/90 transition-colors disabled:opacity-40">
          {saving ? "Sending…" : "Send little win 💛"}
        </button>
      </div>
    </Modal>
  );
}
