"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/Modal";
import { getWeekOf } from "@/lib/utils";

export default function CheckInModal({ onClose, spaceId }: { onClose: () => void; spaceId: string }) {
  const { role } = useAuth();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await supabase
        .from('checkins')
        .insert({
          space_id: spaceId,
          week_of: getWeekOf(),
          note: note.trim(),
          submitted_by: role,
        });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <Modal title="Weekly Check-In" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm font-sans text-muted">How did money & time feel this week?</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Felt like a good week financially. Work was busy but we managed..." autoFocus rows={5}
          className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans resize-none focus:outline-none focus:ring-2 focus:ring-partner-a" />
        <button onClick={handleSave} disabled={!note.trim() || saving}
          className="w-full py-3.5 bg-partner-a text-background font-sans font-medium rounded-xl hover:bg-partner-a/90 transition-colors disabled:opacity-40">
          {saving ? "Saving…" : "Submit check-in"}
        </button>
      </div>
    </Modal>
  );
}
