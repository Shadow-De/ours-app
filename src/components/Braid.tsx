"use client";

import { motion, useReducedMotion } from "framer-motion";

interface BraidDividerProps {
  className?: string;
  height?: number;
}

/**
 * The Braid — the signature visual element.
 * Two thin lines (Partner A teal + Partner B violet) that weave and cross.
 * Used as a header divider beneath the page title on every screen.
 */
export function BraidDivider({ className = "", height = 20 }: BraidDividerProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <svg
      className={`w-full ${className}`}
      height={height}
      viewBox="0 0 375 20"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Partner A neon lime strand */}
      <motion.path
        d="M0,10 C47,2 94,18 141,10 C188,2 235,18 282,10 C329,2 352,18 375,10"
        fill="none"
        stroke="#C9F24C"
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      {/* Partner B neon aqua strand */}
      <motion.path
        d="M0,10 C47,18 94,2 141,10 C188,18 235,2 282,10 C329,18 352,2 375,10"
        fill="none"
        stroke="#4CE0C9"
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
      />
    </svg>
  );
}

interface BraidProgressBarProps {
  /** 0–1 progress value */
  progress: number;
  className?: string;
  height?: number;
  showLabel?: boolean;
}

/**
 * The Braid Progress Bar — used on goal cards.
 * Fills from teal (Partner A) through violet to gold (shared completion).
 * Animates on data change, not on every render.
 */
export function BraidProgressBar({
  progress,
  className = "",
  height = 12,
  showLabel = false,
}: BraidProgressBarProps) {
  const shouldReduceMotion = useReducedMotion();
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const pct = Math.round(clampedProgress * 100);

  return (
    <div className={`relative flex flex-col ${className}`}>
      {showLabel && (
        <span className="self-end mb-1 text-xs font-mono text-muted">
          {pct}%
        </span>
      )}
      {/* Track */}
      <div
        className="w-full rounded-full overflow-hidden bg-surface-raised shadow-inner"
        style={{ height }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% complete`}
      >
        {/* Fill — CSS gradient from Partner A → Shared Gold → Partner B */}
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(to right, #C9F24C, #E8D24C, #4CE0C9)`,
            transformOrigin: "left center",
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: clampedProgress }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.7, ease: [0.4, 0, 0.2, 1] }
          }
        />
      </div>
    </div>
  );
}
