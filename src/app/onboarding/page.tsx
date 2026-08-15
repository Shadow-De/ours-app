"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider } from "@/components/Braid";
// generateSpaceId removed — using crypto.randomUUID() inline

export default function OnboardingPage() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"signin" | "name">("signin");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    const result = await signInWithGoogle();
    if (result?.user) {
      try {
        // Check if user already has a space (with timeout to prevent hanging)
        const { getDoc, doc: firestoreDoc } = await import("firebase/firestore");
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("firestore_timeout")), 6000)
        );
        const userSnap = await Promise.race([
          getDoc(firestoreDoc(db, "users", result.user.uid)),
          timeoutPromise,
        ]);
        if (userSnap.exists()) {
          // Already paired — redirect to home
          router.push("/");
          return;
        }
        setStep("name");
      } catch (err: any) {
        console.error("Firestore error during sign-in:", err);
        // On timeout or offline — assume new user and proceed to name step
        if (err.message === "firestore_timeout" || err.code === "unavailable") {
          setStep("name");
        } else {
          setError("Could not connect to database. Please check your connection.");
        }
      }
    } else {
      setError("Sign-in failed. Please try again.");
    }
    setLoading(false);
  };

  const handleCreateSpace = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    setError("");

    try {
      // Use server-side API route (Admin SDK) — bypasses browser Firestore WebChannel
      const idToken = await user.getIdToken();
      const res = await fetch("/api/onboarding/create-space", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create space");
      }

      // Also call token endpoint to set up calendar (non-fatal)
      try {
        await fetch("/api/auth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ uid: user.uid }),
        });
      } catch {
        // Non-fatal — calendar sync can be set up later
      }

      router.push("/waiting");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="text-center mb-2">
          <h1 className="font-display text-7xl font-light text-primary tracking-tight">
            Us.
          </h1>
        </div>

        {/* The Braid */}
        <BraidDivider className="mb-6" />

        <p className="text-center text-muted font-sans mb-10 text-base">
          A private space for two.
        </p>

        {step === "signin" && (
          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-surface border border-white/10 rounded-full px-4 py-4 text-primary font-sans font-medium text-[15px] transition-all hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoadingSpinner />
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </button>
            <p className="text-center text-xs text-muted font-sans">
              This will ask for Google Calendar access
            </p>
            {error && (
              <p className="text-center text-sm text-alert font-sans">{error}</p>
            )}
          </div>
        )}

        {step === "name" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-sans font-medium text-muted mb-1.5">
                What&apos;s your name?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateSpace()}
                placeholder="Your first name"
                autoFocus
                className="w-full bg-surface border-none rounded-2xl px-5 py-4 text-primary font-sans text-[15px] focus:outline-none focus:ring-2 focus:ring-partner-a placeholder:text-muted"
              />
            </div>
            <button
              onClick={handleCreateSpace}
              disabled={!name.trim() || loading}
              className="w-full bg-partner-a text-background font-sans font-medium py-4 rounded-full transition-all hover:bg-partner-a/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Creating space…" : "Start our space →"}
            </button>
            {error && (
              <p className="text-center text-sm text-alert font-sans">{error}</p>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin w-5 h-5 text-muted"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
