"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { Role } from "@/lib/types";

interface NicknameModalProps {
  onClose: () => void;
  spaceId: string;
  partnerRole: Role;
  partnerRealName: string;
}

export default function NicknameModal({ onClose, spaceId, partnerRole, partnerRealName }: NicknameModalProps) {
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setSaving(true);
    try {
      // Fetch current space to get nicknames jsonb
      const { data: space } = await supabase
        .from('spaces')
        .select('nicknames')
        .eq('id', spaceId)
        .single();
        
      const currentNicknames = space?.nicknames || { forA: null, forB: null };
      
      const newNicknames = {
        ...currentNicknames,
        [partnerRole === "a" ? "forA" : "forB"]: nickname.trim()
      };
      
      await supabase
        .from('spaces')
        .update({ nicknames: newNicknames })
        .eq('id', spaceId);
        
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <Modal title={`Nickname for ${partnerRealName}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted font-sans">
          This is how {partnerRealName} will appear throughout the app.
        </p>
        <div>
          <label className="block text-sm font-sans font-medium text-muted mb-1.5">
            What should we call {partnerRealName}?
          </label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={`e.g. ${partnerRealName.split(" ")[0]}`} autoFocus
            className="w-full bg-surface border-none rounded-xl px-4 py-3 text-primary font-sans focus:outline-none focus:ring-2 focus:ring-partner-a" />
        </div>
        <button onClick={handleSave} disabled={!nickname.trim() || saving}
          className="w-full py-3.5 bg-partner-a text-background font-sans font-medium rounded-xl hover:bg-partner-a/90 transition-colors disabled:opacity-40">
          {saving ? "Saving…" : "Set nickname"}
        </button>
      </div>
    </Modal>
  );
}
