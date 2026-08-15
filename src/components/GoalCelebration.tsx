"use client";

import { useReducedMotion, motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

interface GoalCelebrationProps {
  goalName: string;
  onDone: () => void;
}

/**
 * Goal Celebration — one deliberate orchestrated moment when a goal is completed.
 * Triggered exactly once per goal via `celebrated` flag in Firestore.
 * Full-screen overlay with confetti and scale-in animation.
 * Respects prefers-reduced-motion.
 */
export default function GoalCelebration({ goalName, onDone }: GoalCelebrationProps) {
  const shouldReduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(onDone, 4000);
    return () => clearTimeout(timer);
  }, [onDone]);

  // Confetti animation
  useEffect(() => {
    if (shouldReduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#C9F24C", "#4CE0C9", "#E8D24C", "#F5F7F3"];
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      color: string; size: number; rotation: number; rotSpeed: number;
    }> = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
      });
    }

    let raf: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.vy += 0.05; // gravity

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [shouldReduceMotion]);

  // Close on Escape or tap
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
      role="dialog"
      aria-modal="true"
      aria-label={`Goal complete: ${goalName}`}
    >
      {/* Confetti canvas */}
      {!shouldReduceMotion && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        />
      )}

      <motion.div
        className="relative z-10 text-center px-8"
        initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 20,
          delay: 0.1,
        }}
      >
        <motion.div
          className="text-7xl mb-4"
          animate={shouldReduceMotion ? {} : {
            rotate: [0, -10, 10, -10, 0],
            scale: [1, 1.2, 1.1, 1.2, 1],
          }}
          transition={{ duration: 0.6, delay: 0.2 }}
          aria-hidden="true"
        >
          🎉
        </motion.div>

        <h1 className="font-display text-4xl font-light text-primary mb-3">
          Goal complete!
        </h1>

        <p className="font-display text-2xl font-light text-partner-a mb-6">
          {goalName}
        </p>

        {/* The Braid — as a celebratory element */}
        <svg
          className="w-48 mx-auto mb-6"
          height="20"
          viewBox="0 0 200 20"
          aria-hidden="true"
        >
          <motion.path
            d="M0,10 C25,2 50,18 75,10 C100,2 125,18 150,10 C175,2 190,18 200,10"
            fill="none"
            stroke="#C9F24C"
            strokeWidth="3"
            style={{ filter: "drop-shadow(0 0 8px #C9F24C)" }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
          <motion.path
            d="M0,10 C25,18 50,2 75,10 C100,18 125,2 150,10 C175,18 190,2 200,10"
            fill="none"
            stroke="#4CE0C9"
            strokeWidth="3"
            style={{ filter: "drop-shadow(0 0 8px #4CE0C9)" }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          />
        </svg>

        <p className="text-sm font-sans text-muted">
          Tap anywhere to continue
        </p>
      </motion.div>
    </motion.div>
  );
}
