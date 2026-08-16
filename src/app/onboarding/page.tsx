"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

export default function OnboardingPage() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"signin" | "name">("signin");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    await signInWithGoogle();
  };

  const handleCreateSpace = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch("/api/onboarding/create-space", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Error (${res.status}): ${text.substring(0, 50)}`);
        }
        throw new Error(data.error || "Failed to create space");
      }

      router.push("/waiting");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  if (user && step === "signin") {
    setStep("name");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-container/5 rounded-full blur-[100px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary-container/5 rounded-full blur-[100px] pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="text-center mb-10">
          <h1 className="font-headline text-4xl sm:text-5xl text-primary font-bold tracking-tight mb-3">
            Us.
          </h1>
          <p className="text-on-surface-variant font-body text-base">
            A private space for just the two of you.
          </p>
        </div>

        {step === "signin" && (
          <div className="space-y-5">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-surface-container hover:bg-surface-container-high inner-highlight rounded-DEFAULT px-4 py-4 text-on-surface font-body font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95"
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
            <p className="text-center text-xs text-on-surface-variant font-body px-4">
              By continuing, you agree to start a shared sanctuary.
            </p>
            {error && (
              <p className="text-center text-sm text-alert font-body">{error}</p>
            )}
          </div>
        )}

        {step === "name" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-body font-medium text-on-surface-variant mb-2 px-1">
                  What should we call you?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateSpace()}
                    placeholder="Your first name"
                    autoFocus
                    className="w-full bg-surface-container inner-highlight rounded-DEFAULT px-5 py-4 text-on-surface font-body text-base focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent placeholder:text-on-surface-variant/50 transition-all border-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateSpace}
              disabled={!name.trim() || loading}
              className="w-full bg-primary-container text-on-primary-container font-headline font-bold py-4 rounded-DEFAULT transition-all hover:bg-primary-fixed-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:cursor-not-allowed neon-glow-primary active:scale-95"
            >
              {loading ? "Preparing..." : "Create Space"}
            </button>
            
            {error && (
              <p className="text-center text-sm text-alert font-body">{error}</p>
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
      className="animate-spin w-5 h-5 text-on-surface-variant"
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
