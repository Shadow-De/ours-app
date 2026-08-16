"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface JoinPageProps {
  params: Promise<{ spaceId: string }>;
}

export default function JoinPage({ params }: JoinPageProps) {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"signin" | "names">("signin");
  const [partnerAName, setPartnerAName] = useState("");
  const [myName, setMyName] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spaceId, setSpaceId] = useState<string>("");
  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const resolvedParams = await params;
      const sid = resolvedParams.spaceId;
      setSpaceId(sid);

      if (user) {
        const res = await fetch(`/api/onboarding/check-space?spaceId=${sid}`);
        
        if (!res.ok) {
          setError("This invite link is invalid or has expired.");
          return;
        }

        const spaceData = await res.json();

        if (spaceData.status !== "awaiting_partner") {
          setError("This space is already full.");
          return;
        }

        setPartnerAName(spaceData.partner_a_real_name);
        setStep("names");
      }
    }
    init();
  }, [user, params, supabase]);

  const handleSignIn = async () => {
    setLoading(true);
    setError("");
    await signInWithGoogle(`/join/${spaceId}`);
  };

  const handleJoin = async () => {
    if (!myName.trim() || !user || !spaceId) return;
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch("/api/onboarding/join-space", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ 
          spaceId, 
          realName: myName.trim(), 
          nicknameForA: nickname.trim() || partnerAName 
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to join space");
      }

      window.location.href = "/";
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary-container/10 rounded-full blur-[100px] pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="text-center mb-10">
          <h1 className="font-headline text-5xl font-bold text-on-background tracking-tight mb-2">
            Us.
          </h1>
        </div>

        {step === "signin" && (
          <div className="space-y-5">
            <div className="text-center mb-8">
              <p className="text-xl font-body font-medium text-on-background">
                You've been invited.
              </p>
              <p className="text-sm text-on-surface-variant font-body mt-1">
                Sign in with Google to join them in a shared private space.
              </p>
            </div>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-surface-container hover:bg-surface-container-high inner-highlight rounded-DEFAULT px-4 py-4 text-on-surface font-body font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95"
            >
              {loading ? <LoadingSpinner /> : <GoogleIcon />}
              Continue with Google
            </button>

            {error && (
              <p className="text-center text-sm text-alert font-body">{error}</p>
            )}
          </div>
        )}

        {step === "names" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-8 bg-surface-container inner-highlight p-4 rounded-DEFAULT">
              <p className="text-base font-body font-medium text-on-surface">
                <span className="text-secondary font-bold">{partnerAName}</span> started your shared space.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-body font-medium text-on-surface-variant mb-2 px-1">
                  What should we call you?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={myName}
                    onChange={(e) => setMyName(e.target.value)}
                    placeholder="Your first name"
                    autoFocus
                    className="w-full bg-surface-container inner-highlight rounded-DEFAULT px-5 py-4 text-on-surface font-body text-base focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent placeholder:text-on-surface-variant/50 transition-all border-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-body font-medium text-on-surface-variant mb-2 px-1">
                  What should we call <span className="text-secondary">{partnerAName}</span>?
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    placeholder={`e.g. ${partnerAName.split(" ")[0]} or a nickname`}
                    className="w-full bg-surface-container inner-highlight rounded-DEFAULT px-5 py-4 text-on-surface font-body text-base focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent placeholder:text-on-surface-variant/50 transition-all border-none"
                  />
                </div>
                <p className="text-[11px] text-on-surface-variant/60 font-body mt-2 px-2 uppercase tracking-wide font-medium">
                  Optional • Leave blank to use their name
                </p>
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={!myName.trim() || loading}
              className="w-full bg-secondary text-on-secondary font-headline font-bold py-4 rounded-DEFAULT transition-all hover:bg-secondary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:cursor-not-allowed neon-glow-secondary active:scale-95"
            >
              {loading ? "Joining…" : "Join the space"}
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
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin w-5 h-5 text-on-surface-variant" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
