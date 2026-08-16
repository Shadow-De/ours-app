"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider } from "@/components/Braid";
import { Space } from "@/lib/types";

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
        // Fetch space to get Partner A's name
        const { data: spaceData, error: spaceError } = await supabase
          .from("spaces")
          .select("*")
          .eq("id", sid)
          .single();

        if (spaceError || !spaceData) {
          setError("This invite link is invalid or has expired.");
          return;
        }

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
    await signInWithGoogle();
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
        throw new Error("Failed to join space");
      }

      router.push("/");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-center mb-2">
          <h1 className="font-display text-6xl font-light text-primary tracking-tight">
            Us.
          </h1>
        </div>

        <BraidDivider className="mb-8" />

        {step === "signin" && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <p className="text-xl font-sans font-medium text-primary">
                Someone started your shared space.
              </p>
              <p className="text-sm text-muted mt-1">
                Sign in with Google to join them.
              </p>
            </div>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-surface border border-white/10 rounded-full px-4 py-4 text-primary font-sans font-medium text-[15px] transition-all hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-b disabled:opacity-50"
            >
              {loading ? <LoadingSpinner /> : <GoogleIcon />}
              Continue with Google
            </button>

            <p className="text-center text-xs text-muted font-sans">
              Just the two of you. Private and paired.
            </p>

            {error && (
              <p className="text-center text-sm text-alert">{error}</p>
            )}
          </div>
        )}

        {step === "names" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="text-center mb-6">
              <p className="text-xl font-sans font-medium text-primary">
                <span className="text-partner-a">{partnerAName}</span> started your shared space.
              </p>
            </div>

            <div>
              <label className="block text-sm font-sans font-medium text-muted mb-1.5">
                What&apos;s your name?
              </label>
              <input
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="Your first name"
                autoFocus
                className="w-full bg-surface border-none rounded-2xl px-5 py-4 text-primary font-sans text-[15px] focus:outline-none focus:ring-2 focus:ring-partner-b placeholder:text-muted"
              />
            </div>

            <div>
              <label className="block text-sm font-sans font-medium text-muted mb-1.5">
                What should we call{" "}
                <span className="text-partner-a">{partnerAName}</span>?
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder={`e.g. ${partnerAName.split(" ")[0]} or a nickname`}
                className="w-full bg-surface border-none rounded-2xl px-5 py-4 text-primary font-sans text-[15px] focus:outline-none focus:ring-2 focus:ring-partner-b placeholder:text-muted"
              />
              <p className="text-xs text-muted mt-2 ml-1">
                Leave blank to use their name as-is
              </p>
            </div>

            <button
              onClick={handleJoin}
              disabled={!myName.trim() || loading}
              className="w-full bg-partner-b text-background font-sans font-medium py-4 rounded-full transition-all hover:bg-partner-b/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-b focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
            >
              {loading ? "Joining…" : "Join the space →"}
            </button>

            <p className="text-center text-xs text-muted">
              Just the two of you. Private and paired.
            </p>

            {error && (
              <p className="text-center text-sm text-alert">{error}</p>
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
    <svg className="animate-spin w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
