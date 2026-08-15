"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

/**
 * Base modal — slide-up from bottom on mobile, centered on desktop.
 * Respects prefers-reduced-motion.
 */
export function Modal({ title, onClose, children, size = "md" }: ModalProps) {
  const shouldReduceMotion = useReducedMotion();

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const sizeClass = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-lg" : "max-w-md";

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Panel */}
        <motion.div
          className={cn(
            "relative z-10 w-full bg-surface-raised rounded-t-2xl sm:rounded-t-2xl",
            "max-h-[90vh] overflow-y-auto",
            `sm:${sizeClass}`,
            "mx-auto sm:mx-4"
          )}
          initial={shouldReduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 id="modal-title" className="font-display text-xl font-light text-primary">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-4 pb-8">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
