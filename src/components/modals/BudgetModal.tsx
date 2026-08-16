"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { DEFAULT_CATEGORIES } from "@/lib/types";

interface BudgetModalProps {
  onClose: () => void;
  spaceId: string;
  budgets: Record<string, number>;
}

export default function BudgetModal({ onClose, spaceId, budgets }: BudgetModalProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c, budgets[c]?.toString() ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    setSaving(true);
    try {
      const inserts = [];
      for (const cat of DEFAULT_CATEGORIES) {
        const val = parseFloat(values[cat]);
        if (!isNaN(val) && val > 0) {
          inserts.push({
            space_id: spaceId,
            category: cat,
            monthly_limit: val
          });
        }
      }
      
      if (inserts.length > 0) {
        // Upsert budgets
        await supabase
          .from('budgets')
          .upsert(inserts, { onConflict: 'space_id, category' });
      }
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <Modal title="Categories & Budgets" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-muted font-sans">Set monthly limits per category. Leave blank for no limit.</p>
        {DEFAULT_CATEGORIES.map((cat) => (
          <div key={cat} className="flex items-center gap-3">
            <span className="flex-1 text-sm font-sans text-primary">{cat}</span>
            <div className="relative w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-mono text-sm">£</span>
              <input type="number" value={values[cat]} onChange={(e) => setValues((v) => ({ ...v, [cat]: e.target.value }))}
                placeholder="No limit" className="w-full pl-7 pr-3 py-2 bg-surface border-none rounded-lg font-mono text-sm text-primary focus:outline-none focus:ring-2 focus:ring-partner-a" />
            </div>
          </div>
        ))}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3.5 bg-partner-a text-background font-sans font-medium rounded-xl hover:bg-partner-a/90 transition-colors disabled:opacity-40 mt-2">
          {saving ? "Saving…" : "Save budgets"}
        </button>
      </div>
    </Modal>
  );
}
